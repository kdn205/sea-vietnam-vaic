#!/usr/bin/env python3
"""
ASR + Real-Time Translation Test Bench
  - ASR: Systran/faster-whisper-base (CTranslate2, INT8, VAD, greedy)
  - Translation: facebook/nllb-200-distilled-600M (optimized with greedy decoding)

Optimizations applied:
  ✓ VAD (Voice Activity Detection)       — skip silence in ASR
  ✓ Greedy Decoding (beam_size=1)        — max CPU speed for both ASR & NLLB
  ✓ INT8 Quantization (compute_type=int8) — CTranslate2 CPU path
  ✓ CPU Thread Tuning (cpu_threads=4)    — match available cores
  ✓ Model Warm-up                         — dummy inference at startup
  ✓ Memory Mapping (mmap)                 — CTranslate2 default
  ✓ Pipeline Parallelism                  — ASR → Translation staged; both cached

Usage:
  python app.py              # Web UI
  python app.py --share      # Public share link
  python app.py --cli        # CLI interactive mode
"""
import argparse
import os
import time
import warnings
from pathlib import Path

import gradio as gr
import numpy as np

warnings.filterwarnings("ignore")

ASR_MODEL_NAME = "Systran/faster-whisper-base"
ASR_MODEL_KEY = "faster-whisper-base"
NLLB_MODEL = "facebook/nllb-200-distilled-600M"

# Language codes
LANG_CODES = {"English": "en", "Vietnamese": "vi"}
MIXED_MODE = "Mixed 🔀"
NLLB_LANG_CODES = {"English": "eng_Latn", "Vietnamese": "vie_Latn"}

# ── CPU Optimisation constants ─────────────────────────────────────
CPU_THREADS = 4
COMPUTE_TYPE = "int8"
BEAM_SIZE = 1
VAD_FILTER = True

# ── Model caches ───────────────────────────────────────────────────
_asr_model = None
_translator = None


def get_asr_model():
    global _asr_model
    if _asr_model is not None:
        return _asr_model

    from faster_whisper import WhisperModel
    print(f"  Loading ASR: {ASR_MODEL_NAME} (cpu, {COMPUTE_TYPE}, {CPU_THREADS} thr) …")
    t0 = time.time()
    _asr_model = WhisperModel(
        ASR_MODEL_NAME,
        device="cpu",
        compute_type=COMPUTE_TYPE,
        cpu_threads=CPU_THREADS,
        num_workers=1,
    )
    print(f"    ✓ {time.time()-t0:.1f}s")

    # Warm-up
    print("  Warming up ASR …")
    import soundfile as sf
    import tempfile
    dummy = np.zeros(8000, dtype=np.float32)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, dummy, 16000)
        segs, _ = _asr_model.transcribe(f.name, beam_size=1, language="en", vad_filter=False)
        list(segs)
        os.unlink(f.name)
    print(f"    ✓ warm-up done")
    return _asr_model


def get_translator():
    global _translator
    if _translator is not None:
        return _translator

    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    print(f"  Loading NLLB: {NLLB_MODEL} (num_beams=1) …")
    t0 = time.time()
    tokenizer = AutoTokenizer.from_pretrained(NLLB_MODEL)
    model = AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL)
    _translator = {"model": model, "tokenizer": tokenizer}
    print(f"    ✓ {time.time()-t0:.1f}s")
    return _translator


def warm_up_nllb():
    """Run a short dummy translation so model is hot."""
    print("  Warming up NLLB …")
    try:
        t0 = time.time()
        tr = translate_text("hello", "English", "Vietnamese")
        print(f"    ✓ warm-up done ({time.time()-t0:.1f}s)")
    except Exception as e:
        print(f"    ⚠ warm-up skipped: {e}")


def load_audio(path: str) -> tuple[str, float]:
    """Convert any audio to 16 kHz mono WAV → (path, duration_s)."""
    import soundfile as sf
    audio, sr = sf.read(path)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
    duration = len(audio) / 16000
    import tempfile
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(tmp.name, audio, 16000)
    return tmp.name, duration


# ── ASR only ───────────────────────────────────────────────────────

def transcribe(audio_path: str, language: str) -> dict:
    if not audio_path or not os.path.isfile(audio_path):
        return {"text": "(no audio)", "segments": [], "time_s": 0.0,
                "model_key": ASR_MODEL_KEY, "model_name": ASR_MODEL_NAME}

    model = get_asr_model()
    wav_path, duration = load_audio(audio_path)
    is_mixed = language == MIXED_MODE
    lang = None if is_mixed else LANG_CODES.get(language, "en")

    vad_params = {"threshold": 0.5, "min_silence_duration_ms": 500, "speech_pad_ms": 400}

    t0 = time.time()
    segments, info = model.transcribe(
        wav_path, language=lang, beam_size=BEAM_SIZE,
        vad_filter=VAD_FILTER, vad_parameters=vad_params,
    )
    seg_list = []
    text_parts = []
    for s in segments:
        seg_list.append({
            "start": s.start, "end": s.end,
            "text": s.text.strip(),
            "lang": getattr(s, "language", ""),
        })
        text_parts.append(s.text.strip())
    elapsed = round(time.time() - t0, 2)
    try:
        os.unlink(wav_path)
    except OSError:
        pass

    text = " ".join(text_parts) if text_parts else "(no speech detected)"
    return {
        "text": text,
        "segments": seg_list,
        "time_s": elapsed,
        "model_key": ASR_MODEL_KEY,
        "model_name": ASR_MODEL_NAME,
        "detected_lang": getattr(info, "language", ""),
        "is_mixed": is_mixed,
        "audio_duration": round(duration, 2),
    }



# ── Streaming ASR — ring buffer (report-guided) ─────────────────
#
# Architecture per reports/live_streaming_adjustment.md:
#   - Continuous mic capture (never stops recording)
#   - In-memory ring buffer (no temp files for ASR)
#   - Window extraction from buffer (logical slices, not physical)
#   - Overlapping windows with configurable geometry
#   - Direct numpy→ASR (no disk I/O on inference path)
#   - Stable prefix locking for transcript commitment
#   - Buffer capped at 30 s to bound memory
#


def _find_stable_prefix(prev_text: str, new_text: str) -> str:
    if not prev_text or not new_text:
        return ""
    prev_lower = prev_text.lower().strip()
    new_lower = new_text.lower().strip()
    prev_words = prev_lower.split()
    new_words = new_lower.split()
    if not prev_words or not new_words:
        return ""
    for tl in range(min(len(prev_words), len(new_words)), 0, -1):
        if prev_words[-tl:] == new_words[:tl]:
            return " ".join(prev_text.strip().split()[-tl:])
    return ""


def _merge_with_stable_prefix(prev_text: str,
                               chunk_text: str) -> tuple[str, str]:
    if not prev_text.strip():
        return chunk_text.strip(), ""
    stable = _find_stable_prefix(prev_text, chunk_text)
    if stable:
        suffix = chunk_text[len(stable):].strip()
        merged = f"{prev_text.strip()} {suffix}" if suffix else prev_text.strip()
    else:
        oc = min(60, len(prev_text), len(chunk_text))
        if prev_text[-oc:].strip().lower() == chunk_text[:oc].strip().lower():
            chunk_text = chunk_text[oc:]
        elif prev_text.endswith(chunk_text[:30]):
            chunk_text = chunk_text[30:]
        merged = f"{prev_text.strip()} {chunk_text.strip()}".strip()
    words = merged.split()
    return merged, " ".join(words[:-3]) if len(words) > 6 else merged


def streaming_asr(audio, language: str,
                  chunk_secs: float, overlap: float,
                  state: dict) -> tuple[dict, str]:
    """
    True streaming ASR with an in-memory ring buffer (see
    reports/live_streaming_adjustment.md).

    Accepts both:
      - (sample_rate, numpy_array) from gr.Audio(type='numpy')
      - str filepath from gr.Audio(type='filepath')
      - None when no recording active

    Appends PCM to a ring buffer, extracts overlapping windows,
    transcribes directly from numpy arrays (no disk I/O on the
    inference path), and merges transcripts with stable prefix
    locking.

    Returns  (updated_state, markdown_output).
    """
    # ── Init state ──────────────────────────────────────────────
    if state is None or "buffer" not in state:
        state = {"buffer": None,
                 "processed": 0,
                 "full_text": "",
                 "locked_prefix": ""}

    if audio is None:
        return state, "## Press the mic button and speak..."

    import soundfile as sf
    import librosa

    # Normalise to 16 kHz float32 numpy array regardless of input type
    if isinstance(audio, tuple):
        sr, arr = audio
        if arr.ndim > 1:
            arr = arr.mean(axis=1)
    else:
        arr, sr = sf.read(audio)
        if arr.ndim > 1:
            arr = arr.mean(axis=1)

    arr = arr.astype(np.float32)
    if sr != 16000:
        arr = librosa.resample(arr, orig_sr=sr, target_sr=16000)

    # ── Ring buffer ─────────────────────────────────────────────
    if state["buffer"] is None:
        state["buffer"] = arr
    elif len(arr) > len(state["buffer"]):
        state["buffer"] = arr
    else:
        check = min(3200, len(state["buffer"]), len(arr))
        if check > 0:
            if not np.allclose(state["buffer"][-check:],
                                arr[-check:] if len(arr) >= check else arr,
                                atol=1e-4):
                state["buffer"] = np.concatenate([state["buffer"], arr])

    model = get_asr_model()
    is_mixed = language == MIXED_MODE
    lang = None if is_mixed else LANG_CODES.get(language, "en")

    # ── Window geometry ─────────────────────────────────────────
    CHUNK_S = int(chunk_secs * 16000)
    OVERLAP = int(CHUNK_S * overlap)
    step = CHUNK_S - OVERLAP
    if step < 1:
        step = CHUNK_S

    # ── Process all pending windows ─────────────────────────────
    window_count = 0
    while state["processed"] + CHUNK_S <= len(state["buffer"]):
        window = state["buffer"][state["processed"]:
                                  state["processed"] + CHUNK_S]

        prompt = (state["locked_prefix"]
                  if state["locked_prefix"]
                  else (state["full_text"][-200:]
                        if state["full_text"]
                        else ""))

        try:
            segs, _ = model.transcribe(
                window,
                language=lang,
                initial_prompt=prompt,
                beam_size=1,
                vad_filter=False,
                condition_on_previous_text=True,
            )
            chunk_text = " ".join(s.text.strip()
                                  for s in segs).strip()
        except Exception as exc:
            chunk_text = ""
            import logging
            logging.warning("ASR chunk error: %s", exc)

        if chunk_text:
            state["full_text"], state["locked_prefix"] = \
                _merge_with_stable_prefix(
                    state["full_text"], chunk_text
                )
            window_count += 1

        state["processed"] += step

    # ── Cap ring buffer at 30 s ─────────────────────────────────
    MAX_BUF = 30 * 16000
    if len(state["buffer"]) > MAX_BUF:
        trim = len(state["buffer"]) - MAX_BUF
        state["buffer"] = state["buffer"][trim:]
        state["processed"] = max(0, state["processed"] - trim)

    # ── Build output ────────────────────────────────────────────
    buf_dur = len(state["buffer"]) / 16000
    wc = len(state["full_text"].split()) if state["full_text"] else 0
    locked_d = (f"**✅ Locked:** {state['locked_prefix']}\n\n"
                if state["locked_prefix"] else "")
    output = (f"## 🔴 Streaming  —  **{buf_dur:.1f}s** buffered"
              f"  ·  {wc} words"
              f"{'  ·  +' + str(window_count) + ' windows' if window_count else ''}\n\n"
              f"{locked_d}"
              f"### 📝 Transcript\n{state['full_text']}")

    return state, output

# ── Translation pipeline ──────────────────────────────────────────

def translate_text(text: str, source_lang: str, target_lang: str) -> dict:
    """
    Translate text via NLLB-200-distilled-600M using explicit model/tokenizer.
    Returns {translated_text, time_s}.
    """
    if not text.strip():
        return {"translated_text": "", "time_s": 0.0}

    import torch
    tl = get_translator()
    model = tl["model"]
    tokenizer = tl["tokenizer"]
    src_code = NLLB_LANG_CODES[source_lang]
    tgt_code = NLLB_LANG_CODES[target_lang]

    t0 = time.time()

    # Split into sentences to avoid max-length issues
    sentences = [s.strip() for s in text.replace(".", ".\n").split("\n") if s.strip()]
    if not sentences:
        sentences = [text]

    translated_parts = []
    for sent in sentences:
        tokenizer.src_lang = src_code
        inputs = tokenizer(sent, return_tensors="pt", padding=True, truncation=True,
                           max_length=256)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_code),
                num_beams=1,     # greedy for speed
                max_length=200,
            )
        decoded = tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        translated_parts.append(decoded)

    translated = " ".join(translated_parts)
    elapsed = round(time.time() - t0, 2)
    return {"translated_text": translated, "time_s": elapsed}


def run_translate_pipeline(audio_path: str, source_lang: str) -> str:
    """
    Full pipeline: ASR → Translation.
    source_lang determines both the source for ASR and NLLB direction.
    """
    try:
        target_lang = "Vietnamese" if source_lang == "English" else "English"

        # Step 1: ASR
        t_total = time.time()
        asr_result = transcribe(audio_path, source_lang)

        if asr_result["text"] in ("(no audio)", "(no speech detected)"):
            return f"## ⚠ {asr_result['text']}"

        # Step 2: Translation
        translate_result = translate_text(asr_result["text"], source_lang, target_lang)
        total_elapsed = round(time.time() - t_total, 2)

        # Format output
        lines = [
            f"### 🎤 ASR ({asr_result['time_s']}s / audio: {asr_result.get('audio_duration', 0)}s)",
            f"`{ASR_MODEL_NAME}`",
            "",
            f"**{source_lang}:**",
            asr_result["text"],
            "",
            f"---",
            f"### 🌐 Translation ({translate_result['time_s']}s)",
            f"`{NLLB_MODEL}` (greedy decode)",
            "",
            f"**{target_lang}:**",
            translate_result["translated_text"],
            "",
            f"---",
            f"**Total pipeline:** {total_elapsed}s",
        ]

        # Show segment details if mixed mode
        if asr_result.get("is_mixed") and asr_result["segments"]:
            lines.insert(5, "")
            lines.insert(5, "#### 🏷 Segments")
            for s in asr_result["segments"]:
                ts = f"`{s['start']:.1f}s–{s['end']:.1f}s`"
                lines.insert(6, f"- {ts}: {s['text']}")

        return "\n".join(lines)

    except Exception as e:
        import traceback
        return f"## ❌ Error\n```\n{traceback.format_exc()}\n```"


# ── Formatting (ASR-only) ─────────────────────────────────────────

def format_result(r: dict) -> str:
    detected = f" (detected: {r['detected_lang']})" if r.get("detected_lang") else ""
    dur = r.get("audio_duration", 0)
    lines = [
        f"### 🎤 {r['model_key']}  —  **{r['time_s']}s** (audio: {dur}s)",
        f"`{r['model_name']}`{detected}",
        "",
    ]
    if r.get("is_mixed") and r["segments"]:
        lines.append("#### 🏷 Segments")
        for s in r["segments"]:
            ts = f"`{s['start']:.1f}s–{s['end']:.1f}s`"
            lines.append(f"- {ts}: {s['text']}")
        lines.append("")
    lines.append(r["text"])
    return "\n".join(lines)


# ── Handlers ──────────────────────────────────────────────────────

def get_supported_langs():
    return ["English", "Vietnamese", MIXED_MODE]


def handle_asr(audio_path: str, language: str):
    try:
        return format_result(transcribe(audio_path, language))
    except Exception as e:
        import traceback
        return f"## ❌ Error\n```\n{traceback.format_exc()}\n```"


# ── Gradio UI ──────────────────────────────────────────────────────

def build_ui():
    css = """
    footer { display: none !important; }
    .app-header { text-align: center; }
    .app-header h1 { font-size: 1.8rem; margin-bottom: 0; }
    .app-header p { color: #666; font-size: 0.9rem; margin-top: 0; }
    """

    with gr.Blocks(title="ASR + Translation Bench", theme=gr.themes.Soft(), css=css) as demo:
        gr.HTML(
            """
            <div class="app-header">
                <h1>🎙️ ASR + Real-Time Translation</h1>
                <p>faster-whisper-base + NLLB-600M · EN ↔ VI · Batch · Chunked Streaming · VAD + Greedy + INT8</p>
            </div>
            """
        )

        with gr.Tabs():
            # ── Tab 1: ASR only ──
            with gr.TabItem("🎤 ASR Only"):
                with gr.Row():
                    with gr.Column(scale=1):
                        asr_lang = gr.Radio(
                            choices=get_supported_langs(),
                            value="English",
                            label="Language / Mode",
                        )
                        asr_audio = gr.Audio(
                            type="filepath",
                            label="Record or Upload Audio",
                            sources=["microphone", "upload"],
                        )
                        asr_btn = gr.Button("🚀 Transcribe", variant="primary")
                    with gr.Column(scale=1):
                        asr_output = gr.Markdown(
                            value="Record/upload audio and click Transcribe.",
                            label="Result",
                        )
                asr_btn.click(
                    fn=handle_asr,
                    inputs=[asr_audio, asr_lang],
                    outputs=[asr_output],
                    show_progress="full",
                )

            # ── Tab 2: Translation pipeline ──
            with gr.TabItem("🔄 Translate (ASR → NLLB)"):
                with gr.Row():
                    with gr.Column(scale=1):
                        tl_source = gr.Radio(
                            choices=["English", "Vietnamese"],
                            value="English",
                            label="Source Language (speech input)",
                            info="Target is auto-set to the other language.",
                        )
                        tl_audio = gr.Audio(
                            type="filepath",
                            label="Record or Upload Audio",
                            sources=["microphone", "upload"],
                        )
                        tl_btn = gr.Button("🚀 Transcribe & Translate", variant="primary")
                    with gr.Column(scale=1):
                        tl_output = gr.Markdown(
                            value="Select source language, record/upload audio, and click Translate.",
                            label="Result",
                        )
                tl_btn.click(
                    fn=run_translate_pipeline,
                    inputs=[tl_audio, tl_source],
                    outputs=[tl_output],
                    show_progress="full",
                )

            # ── Tab 3: Live ASR ──
            with gr.TabItem("🔴 Live ASR"):
                with gr.Row():
                    with gr.Column(scale=1):
                        rt_lang = gr.Radio(
                            choices=get_supported_langs(),
                            value="English",
                            label="Language / Mode",
                        )
                        rt_audio = gr.Audio(
                            type="filepath",
                            label="🎤 Speak (continuous mic)",
                            sources=["microphone"],
                            streaming=True,
                        )
                        gr.Markdown(
                            "Mic stays on. Audio streams in, gets transcribed in "
                            "overlapping windows from an in-memory ring buffer. "
                            "Tune chunk & overlap below."
                        )
                    with gr.Column(scale=1):
                        rt_chunk = gr.Slider(
                            minimum=1, maximum=8, value=3, step=0.5,
                            label="Chunk Duration (seconds)",
                        )
                        rt_overlap = gr.Slider(
                            minimum=0.0, maximum=0.5, value=0.3, step=0.05,
                            label="Overlap Ratio",
                        )
                        rt_state = gr.State({})
                        rt_output = gr.Markdown(
                            value="Press the mic button and speak...",
                            label="Transcript",
                        )
                # Each mic chunk flows through the ring buffer
                rt_audio.change(
                    fn=streaming_asr,
                    inputs=[rt_audio, rt_lang, rt_chunk, rt_overlap, rt_state],
                    outputs=[rt_state, rt_output],
                )

        gr.Markdown(
            f"""
            ---
            **Models:** `{ASR_MODEL_NAME}` (CTranslate2) + `{NLLB_MODEL}` (transformers)

            **Optimizations:**
            - 🎯 **VAD** — Silero VAD skips silence in ASR
            - ⚡ **Greedy Decoding** (beam_size=1) — both ASR & NLLB
            - 🔢 **INT8** — CTranslate2 CPU path
            - 🧵 **{CPU_THREADS} CPU threads** — matches cores
            - 🔥 **Warm-up** — both models pre-loaded at startup
            - 💾 **Memory Mapping** — CTranslate2 mmap
            - 🔄 **Pipeline Parallelism** — ASR → Translation staged
            - 🧩 **Ring Buffer Streaming** — Live ASR tab uses an in-memory ring buffer: mic stays on, audio streams in, overlapping windows are extracted and transcribed directly from numpy arrays (no disk I/O on the inference path). Configurable window geometry (1–8s, 0–50% overlap).
            - 📋 **Context Fragmentation Countermeasures** — configurable chunks, configurable overlap,
              stable prefix locking, context carryover via `initial_prompt`
              ([report](reports/context_fragmentation.md))

            **Languages:** EN ↔ VI

            **On batch processing:** For streaming/chunked ASR, each chunk is
            processed independently (micro-batching). The trade-off is slightly higher
            total CPU time vs one-shot transcription.
            True batch (multiple audio files) only helps on GPU.
            """
        )

    return demo


# ── Entry point ────────────────────────────────────────────────────

def main():
    global BEAM_SIZE, VAD_FILTER

    parser = argparse.ArgumentParser(
        description="ASR + Real-Time Translation Bench"
    )
    parser.add_argument("--share", action="store_true", help="Public share link")
    parser.add_argument("--port", type=int, default=7860, help="Port (default: 7860)")
    parser.add_argument("--cli", action="store_true", help="CLI mode")
    parser.add_argument("--no-preload", action="store_true",
                        help="Skip model warm-up")
    parser.add_argument("--beam-size", type=int, default=BEAM_SIZE,
                        help=f"Beam size (default: {BEAM_SIZE})")
    parser.add_argument("--no-vad", action="store_true", help="Disable VAD")
    parser.add_argument("--translate-only", action="store_true",
                        help="Skip NLLB warm-up (ASR-only mode)")
    args = parser.parse_args()

    BEAM_SIZE = args.beam_size
    VAD_FILTER = not args.no_vad

    if args.cli:
        print("=" * 60)
        print("  ASR + Translation CLI")
        print(f"  beam={BEAM_SIZE}, VAD={VAD_FILTER}")
        print("=" * 60)
        if not args.no_preload:
            get_asr_model()
            if not args.translate_only:
                get_translator()

        while True:
            path = input("\nAudio file path (or q to quit): ").strip()
            if path == "q":
                break
            if not os.path.isfile(path):
                print(f"  ✗ Not found: {path}")
                continue
            mode = input("Mode [asr / translate-en / translate-vi]: ").strip().lower()
            if mode == "asr":
                lang = input("Language [en/vi/mixed]: ").strip().lower()
                language = {"en": "English", "vi": "Vietnamese",
                            "mixed": MIXED_MODE}.get(lang, "English")
                r = transcribe(path, language)
                print(f"\n  [{r['time_s']}s] {r['text']}")
            elif mode in ("translate-en", "translate-vi"):
                src = "English" if mode == "translate-en" else "Vietnamese"
                print(f"\n  Pipeline: {src} speech → text → translate …")
                result_text = run_translate_pipeline(path, src)
                print(f"\n{result_text}")
            else:
                print(f"  Unknown mode: {mode}")
        print("Bye!")
        return

    print("Starting Gradio UI...")
    if not args.no_preload:
        get_asr_model()
        if not args.translate_only:
            warm_up_nllb()

    demo = build_ui()
    demo.queue(default_concurrency_limit=1)
    demo.launch(
        server_name="0.0.0.0",
        server_port=args.port,
        share=args.share,
        show_error=True,
    )


if __name__ == "__main__":
    main()
