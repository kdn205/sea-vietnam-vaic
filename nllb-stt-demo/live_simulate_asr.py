#!/usr/bin/env python3
"""
Live ASR streaming simulator.
Feeds a test audio file to the ring-buffer ASR pipeline in small
chunks (200ms each) — exactly as Gradio's streaming mic would.
No actual microphone needed.

Usage:
  python live_simulate_asr.py <audio_file> [--chunk 3] [--overlap 0.3]
  python live_simulate_asr.py                           # uses built-in test
"""

import argparse
import os
import sys
import time
import numpy as np

# Reuse the app's pipeline (model, helpers, LANG_CODES, MIXED_MODE)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import (
    get_asr_model,
    _merge_with_stable_prefix,
    streaming_asr,
    LANG_CODES,
    MIXED_MODE,
)


def simulate_streaming(
    audio_path: str,
    chunk_secs: float = 3.0,
    overlap: float = 0.3,
    lang: str = "English",
    chunk_ms: int = 200,
    inter_chunk_delay: float = 0.05,
):
    """
    Feed audio to streaming_asr in tiny chunks, simulating Gradio's
    streaming=True mic behaviour.  Shows ring-buffer growth and
    transcript progression.
    """
    import soundfile as sf
    import librosa

    # Load full audio
    audio, sr = sf.read(audio_path)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != 16000:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
    pcm = audio.astype(np.float32)
    total_samples = len(pcm)
    total_dur = total_samples / 16000

    print(f"Audio: {total_dur:.1f}s @ 16 kHz ({total_samples} samples)")
    print(f"Window: {chunk_secs}s  overlap: {overlap:.0%}")
    print(f"Chunk size: {chunk_ms}ms ({chunk_ms * 16 // 1000 * 1000} samples)")
    print(f"{'─' * 60}")

    # Simulate streaming: feed in small chunks
    chunk_len = int(chunk_ms * 16)  # samples per simulated chunk
    state = None
    t0 = time.time()
    n_chunks = 0

    for start in range(0, total_samples, chunk_len):
        chunk = pcm[start: start + chunk_len]
        if len(chunk) == 0:
            break

        # Simulate a Gradio .change() event
        state, output = streaming_asr(
            (16000, chunk), lang, chunk_secs, overlap, state
        )

        n_chunks += 1
        buf_dur = len(state["buffer"]) / 16000 if state["buffer"] is not None else 0
        pct = min(start / total_samples * 100, 100)

        # Compact one-line progress
        status = (
            f"\r[{time.time() - t0:5.1f}s] "
            f"chunk #{n_chunks:3d}  "
            f"buf={buf_dur:4.1f}s  "
            f"proc={state['processed'] / 16000:4.1f}s  "
            f"{pct:3.0f}%  "
            f"words={len(state['full_text'].split()) if state['full_text'] else 0:3d}  "
            f"txt={state['full_text'][:80] if state['full_text'] else '(none)'}"
        )
        print(status, end="", flush=True)

        if inter_chunk_delay:
            time.sleep(inter_chunk_delay)

    elapsed = time.time() - t0
    print(f"\n{'─' * 60}")
    print(f"Done in {elapsed:.1f}s ({n_chunks} chunks)")
    print(f"Final transcript ({len(state['full_text'].split())} words):")
    print(f"  {state['full_text']}")
    print(f"Ring buffer: {len(state['buffer']) / 16000:.1f}s / {len(state['buffer'])} samples")
    print(f"Locked prefix: {state['locked_prefix']!r}")

    return state


def main():
    parser = argparse.ArgumentParser(
        description="Simulate Gradio streaming ASR with a test audio file"
    )
    parser.add_argument("audio", nargs="?", default=None,
                        help="Path to audio file")
    parser.add_argument("--chunk", type=float, default=3.0,
                        help="Window chunk size in seconds")
    parser.add_argument("--overlap", type=float, default=0.3,
                        help="Window overlap ratio (0.0–0.5)")
    parser.add_argument("--lang", default="English",
                        help="Language (English, Vietnamese, Mixed)")
    parser.add_argument("--chunk-ms", type=int, default=200,
                        help="Simulated mic chunk size in ms")
    parser.add_argument("--delay", type=float, default=0.05,
                        help="Inter-chunk delay in seconds")
    args = parser.parse_args()

    if args.audio:
        audio_path = args.audio
    else:
        # Download a built-in test file
        import requests
        import tempfile
        url = "https://huggingface.co/datasets/Narsil/asr_dummy/resolve/main/1.flac"
        print(f"Downloading default test file: {url}")
        r = requests.get(url)
        t = tempfile.NamedTemporaryFile(suffix=".flac", delete=False)
        t.write(r.content)
        t.close()
        audio_path = t.name
        print(f"  → saved to {audio_path}")

    simulate_streaming(
        audio_path,
        chunk_secs=args.chunk,
        overlap=args.overlap,
        lang=args.lang,
        chunk_ms=args.chunk_ms,
        inter_chunk_delay=args.delay,
    )

    # Clean up temp file if we created one
    if not args.audio and "audio_path" in locals():
        os.unlink(audio_path)


if __name__ == "__main__":
    main()
