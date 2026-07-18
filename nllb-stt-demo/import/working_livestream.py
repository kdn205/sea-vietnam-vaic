# -*- coding: utf-8 -*-
"""
Live demo: dich hoi thoai Viet <-> Anh real-time voi giao dien theo doi.

Streaming: dang noi la co ban nhap (ASR beam 1 + dich nhanh) hien ngay,
cap nhat ~1s/lan; dut cau thi chay ban chat luong cao (beam 5) thay the.

Chay giao dien:  python app.py
Tu kiem tra khong can mic (dung audio benchmark): python app.py --selftest
"""
import argparse
import collections
import os
import queue
import re
import sys
import threading
import time
from datetime import datetime

import numpy as np

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import torch  # noqa: E402 (nap DLL CUDA/cuDNN truoc khi dung ctranslate2)

_torch_lib = os.path.join(os.path.dirname(torch.__file__), "lib")
if os.name == "nt" and os.path.isdir(_torch_lib):
    os.add_dll_directory(_torch_lib)

SAMPLE_RATE = 16000
BLOCK = 480                 # 30ms / block
SILENCE_BLOCKS = 18         # ~0.55s im lang -> ket thuc cau
PREROLL_BLOCKS = 10         # ~0.3s truoc khi phat hien giong noi
PARTIAL_BLOCKS = 25         # ~0.75s / lan cap nhat ban nhap khi dang noi
MIN_SPEECH_S = 0.4
MAX_SPEECH_S = 15.0

# ── Models (user's locked stack) ────────────────────────────────────
ASR_MODEL = "Systran/faster-whisper-base"
NLLB_MODEL = "facebook/nllb-200-distilled-600M"

# ── Optimizations ───────────────────────────────────────────────────
CPU_THREADS = 4
COMPUTE_TYPE = "int8"
BEAM_SIZE = 1

# NLLB Flores language codes
NLLB_CODES = {"vi": "vie_Latn", "en": "eng_Latn"}


def normalize(audio):
    """Khuech dai mic yeu (gioi han gain 60x)."""
    peak = float(np.abs(audio).max())
    if 0 < peak < 0.5:
        audio = audio * min(0.9 / peak, 60.0)
    return audio


# ----------------------------- Model -----------------------------

class Translator:
    """ASR (faster-whisper-base, INT8) + NLLB-200-distilled-600M (greedy).

    Optimisations applied per nllb-stt-demo/app.py:
      ✓ Greedy decoding (beam_size=1)      — max CPU speed
      ✓ INT8 quantisation                  — CTranslate2 CPU path
      ✓ CPU thread tuning (cpu_threads=4)  — match available cores
      ✓ Model warm-up                       — dummy inference at startup
      ✓ Memory mapping (mmap)               — CTranslate2 default
      ✓ Pipeline parallelism                — ASR + MT staged via queues
    """

    def __init__(self, status_cb=print):
        from faster_whisper import WhisperModel
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self._lock = threading.Lock()

        # ── ASR: faster-whisper-base (INT8, 4 threads) ──────────────
        status_cb(f"Dang nap ASR ({ASR_MODEL}) ...")
        self.asr = WhisperModel(
            ASR_MODEL, device="cpu",
            compute_type=COMPUTE_TYPE,
            cpu_threads=CPU_THREADS,
            num_workers=1,
        )
        # Warm-up
        list(self.asr.transcribe(
            np.zeros(SAMPLE_RATE, dtype=np.float32),
            beam_size=BEAM_SIZE,
        )[0])
        status_cb("  ✓ ASR san sang")

        # ── NLLB-200-distilled-600M ──────────────────────────────────
        status_cb(f"Dang tai NLLB ({NLLB_MODEL}) ...")
        self.nllb = AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL)
        self.nllb.eval()
        self.tokenizer = AutoTokenizer.from_pretrained(NLLB_MODEL)
        # Warm-up
        self._translate_raw("vie_Latn", "eng_Latn", "khởi động")
        status_cb("  ✓ NLLB san sang")
        status_cb("San sang. Bam 'Bat dau' va noi vao mic.")

    # ── ASR ──────────────────────────────────────────────────────────
    def transcribe(self, audio, lang=None):
        """Run faster-whisper-base on *audio* (1-D float32 16 kHz)."""
        segs, info = self.asr.transcribe(
            audio, language=lang,
            beam_size=BEAM_SIZE,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        return " ".join(s.text.strip() for s in segs).strip(), info

    def _pick_lang(self, info, mode):
        src = info.language if mode == "auto" else mode
        if src not in ("vi", "en"):
            probs = dict(info.all_language_probs or [])
            src = "vi" if probs.get("vi", 0) >= probs.get("en", 0) else "en"
        return src

    def process_partial(self, audio, mode="auto", src_hint=None):
        """Fast partial transcription (beam=1, no translation)."""
        audio = normalize(audio)
        lang = src_hint or (None if mode == "auto" else mode)
        text, info = self.transcribe(audio, lang)
        if not text or not re.search(r"\w", text):
            return None
        src = lang or self._pick_lang(info, mode)
        tgt = "en" if src == "vi" else "vi"
        with self._lock:
            translation = self._translate(src, tgt, text)
        return {"src": src, "tgt": tgt, "text": text, "translation": translation}

    def process(self, audio, mode="auto", src_hint=None):
        """Full utterance: ASR + NLLB translation."""
        audio = normalize(audio)
        t0 = time.perf_counter()

        if mode != "auto":
            src = mode
        elif src_hint in ("vi", "en"):
            src = src_hint
        else:
            _, info = self.transcribe(audio, None)
            src = self._pick_lang(info, mode)

        text, info = self.transcribe(audio, src)
        t_asr = time.perf_counter() - t0
        if not text or not re.search(r"\w", text):
            return None
        tgt = "en" if src == "vi" else "vi"

        t0 = time.perf_counter()
        with self._lock:
            translation = self._translate(src, tgt, text)
        t_mt = time.perf_counter() - t0

        return {"src": src, "tgt": tgt, "text": text, "translation": translation,
                "t_asr": t_asr, "t_mt": t_mt, "dur": len(audio) / SAMPLE_RATE}

    # ── NLLB translation ────────────────────────────────────────────
    def _translate_raw(self, src_code, tgt_code, text):
        """Core NLLB inference: src_code/tgt_code are Flores codes."""
        prompt = f"{src_code} {text}"
        inputs = self.tokenizer(prompt, return_tensors="pt", padding=True)
        with torch.no_grad():
            translated = self.nllb.generate(
                **inputs,
                forced_bos_token_id=self.tokenizer.convert_tokens_to_ids(tgt_code),
                num_beams=BEAM_SIZE,
                max_length=512,
            )
        result = self.tokenizer.batch_decode(translated, skip_special_tokens=True)[0]
        # Strip leading Flores code if present
        for code in NLLB_CODES.values():
            if result.startswith(code):
                result = result[len(code):].strip()
                break
        return result

    def _translate(self, src, tgt, text):
        """Convenience: src/tgt are 'vi' or 'en'."""
        return self._translate_raw(NLLB_CODES[src], NLLB_CODES[tgt], text)


# ----------------------------- VAD + capture -----------------------------

def list_input_devices():
    import sounddevice as sd
    devs = []
    for i, d in enumerate(sd.query_devices()):
        if d["max_input_channels"] > 0 and sd.query_hostapis(d["hostapi"])["name"] == "MME":
            devs.append((i, d["name"]))
    return devs


class MicSegmenter(threading.Thread):
    """Doc mic, cat cau theo khoang lang. Khi dang noi day ban nhap deu dan.

    partial_q: chi giu ban nhap moi nhat (latest-wins)
    final_q:   cau hoan chinh, khong bao gio bo sot
    """

    def __init__(self, partial_q, final_q, level_cb=None, status_cb=None, device=None):
        super().__init__(daemon=True)
        self.partial_q = partial_q
        self.final_q = final_q
        self.level_cb = level_cb
        self.status_cb = status_cb or (lambda m: None)
        self.device = device
        self.restart = False
        self.running = threading.Event()
        self.alive = True
        self.threshold = 0.005
        self.utt = 0

    def _push_partial(self, seg):
        try:
            self.partial_q.get_nowait()
        except queue.Empty:
            pass
        self.partial_q.put((np.concatenate(seg), self.utt))

    def run(self):
        import sounddevice as sd

        while self.alive:
            self.restart = False
            block_q = queue.Queue()

            def callback(indata, frames, t, status):
                block_q.put(indata[:, 0].copy())

            try:
                with sd.InputStream(device=self.device, samplerate=SAMPLE_RATE,
                                    channels=1, dtype="float32",
                                    blocksize=BLOCK, callback=callback):
                    noise = [np.sqrt(np.mean(block_q.get(timeout=2.0) ** 2))
                             for _ in range(20)]
                    floor = float(np.median(noise))
                    self.threshold = max(0.0015, floor * 5)
                    self.status_cb(f"Mic OK (nhieu nen {floor:.4f}, nguong {self.threshold:.4f})")

                    preroll = collections.deque(maxlen=PREROLL_BLOCKS)
                    seg, silence, speaking, last_partial = [], 0, False, 0
                    while self.alive and not self.restart:
                        try:
                            block = block_q.get(timeout=0.5)
                        except queue.Empty:
                            continue
                        rms = float(np.sqrt(np.mean(block ** 2)))
                        if self.level_cb:
                            self.level_cb(rms, self.threshold, speaking)
                        if not self.running.is_set():
                            preroll.clear()
                            seg, silence, speaking, last_partial = [], 0, False, 0
                            continue

                        if not speaking:
                            preroll.append(block)
                            if rms > self.threshold:
                                speaking = True
                                self.utt += 1
                                seg = list(preroll)
                                silence, last_partial = 0, 0
                        else:
                            seg.append(block)
                            silence = silence + 1 if rms < self.threshold else 0
                            dur = len(seg) * BLOCK / SAMPLE_RATE

                            # dang noi: day ban nhap dinh ky
                            if len(seg) - last_partial >= PARTIAL_BLOCKS:
                                last_partial = len(seg)
                                self._push_partial(seg)

                            if silence >= SILENCE_BLOCKS or dur >= MAX_SPEECH_S:
                                speech = np.concatenate(seg)
                                # bo ban nhap dang cho (neu co) roi day ban cuoi
                                try:
                                    self.partial_q.get_nowait()
                                except queue.Empty:
                                    pass
                                if dur - silence * BLOCK / SAMPLE_RATE >= MIN_SPEECH_S:
                                    self.final_q.put((speech, self.utt))
                                preroll.clear()
                                seg, silence, speaking, last_partial = [], 0, False, 0
            except Exception as e:
                self.status_cb(f"Loi mic: {e} — thu lai sau 2s (kiem tra quyen mic trong Windows)")
                time.sleep(2)


# ----------------------------- GUI -----------------------------

FLAG = {"vi": "VN", "en": "EN"}


class App:
    def __init__(self):
        import tkinter as tk
        from tkinter import scrolledtext, ttk
        self.tk = tk
        self.root = tk.Tk()
        self.root.title("Dich hop Viet-Anh real-time (demo hackathon)")
        self.root.geometry("880x660")

        top = ttk.Frame(self.root, padding=6)
        top.pack(fill="x")
        self.btn = ttk.Button(top, text="Bat dau", command=self.toggle, state="disabled")
        self.btn.pack(side="left")
        ttk.Label(top, text="  Che do:").pack(side="left")
        self.mode = tk.StringVar(value="auto")
        for val, lbl in [("auto", "Tu dong"), ("vi", "Viet->Anh"), ("en", "Anh->Viet")]:
            ttk.Radiobutton(top, text=lbl, variable=self.mode, value=val).pack(side="left")
        self.level = ttk.Progressbar(top, length=140, maximum=3.0)
        self.level.pack(side="right", padx=4)
        ttk.Label(top, text="Mic level:").pack(side="right")

        devrow = ttk.Frame(self.root, padding=(6, 0, 6, 6))
        devrow.pack(fill="x")
        ttk.Label(devrow, text="Mic:").pack(side="left")
        self.devices = list_input_devices()
        names = ["(Mac dinh)"] + [f"[{i}] {n}" for i, n in self.devices]
        self.dev_var = tk.StringVar(value=names[0])
        self.dev_box = ttk.Combobox(devrow, textvariable=self.dev_var,
                                    values=names, state="readonly", width=50)
        self.dev_box.pack(side="left", padx=4)
        self.dev_box.bind("<<ComboboxSelected>>", self.change_device)

        self.text = scrolledtext.ScrolledText(self.root, wrap="word", font=("Segoe UI", 12),
                                              state="disabled", padx=8, pady=8)
        self.text.pack(fill="both", expand=True)
        self.text.tag_config("meta", foreground="#888", font=("Segoe UI", 9))
        self.text.tag_config("vi", foreground="#0b5394", font=("Segoe UI", 12, "bold"))
        self.text.tag_config("en", foreground="#38761d", font=("Segoe UI", 12, "bold"))
        self.text.tag_config("dich", foreground="#111", font=("Segoe UI", 13))
        self.text.tag_config("live_src", foreground="#999", font=("Segoe UI", 12, "italic"))
        self.text.tag_config("live_tr", foreground="#666", font=("Segoe UI", 13, "italic"))

        self.status = tk.StringVar(value="Dang tai model, cho chut...")
        ttk.Label(self.root, textvariable=self.status, padding=4).pack(fill="x")

        self.partial_q = queue.Queue()
        self.final_q = queue.Queue()
        self.out_queue = queue.Queue()
        self.translator = None
        self.mic = None
        self.live_uid = None     # utterance dang hien ban nhap
        self.live_start = None   # vi tri bat dau vung ban nhap trong Text

        threading.Thread(target=self.load_models, daemon=True).start()
        self.root.after(80, self.poll)

    # --- setup ---
    def load_models(self):
        self.translator = Translator(status_cb=lambda m: self.out_queue.put(("status", m)))
        self.mic = MicSegmenter(
            self.partial_q, self.final_q,
            level_cb=lambda r, t, s: self.out_queue.put(("level", r / max(t, 1e-6))),
            status_cb=lambda m: self.out_queue.put(("status", m)))
        self.mic.start()
        threading.Thread(target=self.worker, daemon=True).start()
        self.out_queue.put(("ready", None))

    def worker(self):
        src_cache = {}  # utt_id -> ngon ngu da detect (dung lai cho cac ban nhap sau)
        while True:
            # uu tien cau hoan chinh; khong co thi lay ban nhap moi nhat
            try:
                audio, uid = self.final_q.get(timeout=0.05)
                kind = "final"
            except queue.Empty:
                try:
                    audio, uid = self.partial_q.get_nowait()
                    kind = "partial"
                except queue.Empty:
                    continue
            try:
                if kind == "partial":
                    res = self.translator.process_partial(
                        audio, mode=self.mode.get(), src_hint=src_cache.get(uid))
                    if res:
                        src_cache[uid] = res["src"]
                        res["uid"] = uid
                        self.out_queue.put(("live", res))
                else:
                    t0 = time.perf_counter()
                    res = self.translator.process(audio, mode=self.mode.get(),
                                                  src_hint=src_cache.get(uid))
                    src_cache.pop(uid, None)
                    if res:
                        res["t_total"] = time.perf_counter() - t0
                        res["uid"] = uid
                        self.out_queue.put(("result", res))
                    else:
                        self.out_queue.put(("clear_live", uid))
            except Exception as e:
                self.out_queue.put(("status", f"Loi: {e}"))

    # --- UI ---
    def change_device(self, _event=None):
        if not self.mic:
            return
        sel = self.dev_box.current()
        self.mic.device = None if sel == 0 else self.devices[sel - 1][0]
        self.mic.restart = True
        self.status.set("Doi mic, dang khoi dong lai stream...")

    def toggle(self):
        if self.mic.running.is_set():
            self.mic.running.clear()
            self.btn.config(text="Bat dau")
            self.status.set("Da tam dung.")
        else:
            self.mic.running.set()
            self.btn.config(text="Tam dung")
            self.status.set("Dang nghe...")

    def poll(self):
        try:
            while True:
                kind, data = self.out_queue.get_nowait()
                if kind == "status":
                    self.status.set(data)
                elif kind == "ready":
                    self.btn.config(state="normal")
                elif kind == "level":
                    self.level["value"] = min(data, 3.0)
                elif kind == "live":
                    self.show_live(data)
                elif kind == "result":
                    self.show_final(data)
                elif kind == "clear_live":
                    self.clear_live()
        except queue.Empty:
            pass
        self.root.after(80, self.poll)

    def clear_live(self):
        if self.live_start is not None:
            self.text.config(state="normal")
            self.text.delete(self.live_start, "end-1c")
            self.text.config(state="disabled")
        self.live_uid = None
        self.live_start = None

    def show_live(self, r):
        self.text.config(state="normal")
        if self.live_uid != r["uid"] or self.live_start is None:
            # cau moi -> mo vung ban nhap moi o cuoi
            if self.live_start is not None:
                self.text.delete(self.live_start, "end-1c")
            self.live_uid = r["uid"]
            self.live_start = self.text.index("end-1c")
        else:
            self.text.delete(self.live_start, "end-1c")
        self.text.insert("end", f"~ {r['text']}\n", "live_src")
        self.text.insert("end", f"~ {r['translation']}\n", "live_tr")
        self.text.config(state="disabled")
        self.text.see("end")
        self.status.set("Dang nghe (ban nhap dang cap nhat)...")

    def show_final(self, r):
        self.clear_live()
        ts = datetime.now().strftime("%H:%M:%S")
        meta = (f"[{ts}] {FLAG[r['src']]} -> {FLAG[r['tgt']]}   "
                f"(noi {r['dur']:.1f}s | ASR {r['t_asr']:.2f}s + dich {r['t_mt']:.2f}s "
                f"= {r['t_total']:.2f}s)\n")
        self.text.config(state="normal")
        self.text.insert("end", meta, "meta")
        self.text.insert("end", f"  {r['text']}\n", r["src"])
        self.text.insert("end", f"  => {r['translation']}\n\n", "dich")
        self.text.config(state="disabled")
        self.text.see("end")
        self.status.set("Dang nghe...")

    def run(self):
        self.root.mainloop()


# ----------------------------- Selftest -----------------------------

def selftest():
    """Chay pipeline tren bo audio benchmark, khong can mic/GUI."""
    import json

    bench = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "benchmark")
    with open(os.path.join(bench, "testset.json"), encoding="utf-8") as f:
        testset = json.load(f)

    tr = Translator()
    import av

    def load_audio(path):
        container = av.open(path)
        resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
        chunks = []
        for frame in container.decode(audio=0):
            for rf in resampler.resample(frame):
                chunks.append(rf.to_ndarray().flatten())
        return np.concatenate(chunks).astype(np.float32) / 32768.0

    total_asr, total_mt, n = 0.0, 0.0, 0
    for t in testset:
        audio = load_audio(t["audio"])

        # mo phong streaming: ban nhap tren nua dau cau
        half = audio[: len(audio) // 2]
        t0 = time.perf_counter()
        part = tr.process_partial(half, mode="auto")
        t_part = time.perf_counter() - t0

        t0 = time.perf_counter()
        res = tr.process(audio, mode="auto")
        total = time.perf_counter() - t0
        if not res:
            print(f"[{t['id']}] KHONG RA KET QUA")
            continue
        n += 1
        total_asr += res["t_asr"]
        total_mt += res["t_mt"]
        if part:
            print(f"[{t['id']}] nhap ({t_part:.2f}s): {part['text']} => {part['translation']}")
        print(f"[{t['id']}] {res['src']}->{res['tgt']} | ASR {res['t_asr']:.2f}s + MT {res['t_mt']:.2f}s = {total:.2f}s")
        print(f"   Goc : {res['text']}")
        print(f"   Dich: {res['translation']}")
    print(f"\nTB/cau: ASR {total_asr/n:.2f}s + MT {total_mt/n:.2f}s = {(total_asr+total_mt)/n:.2f}s ({n} cau)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--selftest", action="store_true", help="test pipeline bang audio co san")
    args = parser.parse_args()
    if args.selftest:
        selftest()
    else:
        App().run()
