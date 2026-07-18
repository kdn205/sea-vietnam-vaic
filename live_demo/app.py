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
if os.path.isdir(_torch_lib):
    os.add_dll_directory(_torch_lib)

SAMPLE_RATE = 16000
BLOCK = 480                 # 30ms / block
SILENCE_BLOCKS = 18         # ~0.55s im lang -> ket thuc cau
PREROLL_BLOCKS = 10         # ~0.3s truoc khi phat hien giong noi
PARTIAL_BLOCKS = 25         # ~0.75s / lan cap nhat ban nhap khi dang noi
MIN_SPEECH_S = 0.4
MAX_SPEECH_S = 15.0

ASR_FAST_MODEL = "Systran/faster-whisper-small"          # ban nhap khi dang noi
ASR_TURBO_MODEL = "deepdml/faster-whisper-large-v3-turbo-ct2"
PHOWHISPER_REPO = "quocphu/PhoWhisper-ct2-FasterWhisper"
MT_MODEL = "VietAI/envit5-translation"

ASR_BASE_MODEL = "Systran/faster-whisper-base"  # dung cho che do mobile (CPU)

# cac lua chon model cho ban cuoi ("pho" = chi tieng Viet, tieng Anh dung model nhanh)
ASR_CHOICES = {
    "whisper-small (nhanh, 2 chieu)":        ("hf", ASR_FAST_MODEL),
    "PhoWhisper-base (mobile, nhe)":         ("pho", "PhoWhisper-base-ct2-fasterWhisper"),
    "PhoWhisper-small (giong Viet)":         ("pho", "PhoWhisper-small-ct2-fasterWhisper"),
    "PhoWhisper-medium (giong Viet, manh)":  ("pho", "PhoWhisper-medium-ct2-fasterWhisper"),
    "large-v3-turbo (chinh xac, cham)":      ("hf", ASR_TURBO_MODEL),
}
ASR_FLAG_MAP = {  # anh xa co --asr cu sang lua chon moi
    "small": "whisper-small (nhanh, 2 chieu)",
    "phowhisper-base": "PhoWhisper-base (mobile, nhe)",
    "phowhisper": "PhoWhisper-small (giong Viet)",
    "phowhisper-medium": "PhoWhisper-medium (giong Viet, manh)",
    "turbo": "large-v3-turbo (chinh xac, cham)",
}
MT_CT2_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "..", "models", "envit5-ct2")


def normalize(audio):
    """Khuech dai mic yeu (gioi han gain 60x)."""
    peak = float(np.abs(audio).max())
    if 0 < peak < 0.5:
        audio = audio * min(0.9 / peak, 60.0)
    return audio


# ----------------------------- Model -----------------------------

class Translator:
    def __init__(self, status_cb=print, asr_choice=None, mobile=False):
        """asr_choice: key trong ASR_CHOICES. mobile=True: ep CPU + model base
        (mo phong dung toc do se co tren dien thoai)."""
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.mobile = mobile
        self.fast_model_path = ASR_BASE_MODEL if mobile else ASR_FAST_MODEL
        self.device = "cpu" if mobile else ("cuda" if torch.cuda.is_available() else "cpu")
        self._ct = "int8_float16" if self.device == "cuda" else "int8"
        self._asr_cache = {}
        self._lock = threading.Lock()

        try:
            self.asr_fast = self._load_asr("hf", self.fast_model_path, status_cb)
        except Exception:
            status_cb("GPU loi, chuyen sang CPU...")
            self.device, self._ct = "cpu", "int8"
            self.asr_fast = self._load_asr("hf", self.fast_model_path, status_cb)

        self.asr_vi_final = self.asr_en_final = self.asr_fast
        if asr_choice and ASR_CHOICES[asr_choice][1] != self.fast_model_path:
            try:
                self.set_final_model(asr_choice, status_cb)
            except Exception as e:
                status_cb(f"Khong tai duoc {asr_choice} ({type(e).__name__}) -> dung whisper-small")

        status_cb(f"Dang tai model dich ({MT_MODEL}) ...")
        self.mt_tok = AutoTokenizer.from_pretrained(MT_MODEL)
        self.mt_ct2 = None
        if os.path.isdir(MT_CT2_DIR):
            # ban CTranslate2 int8: nhanh gap 4-8 lan ban transformers
            import ctranslate2
            self.mt_ct2 = ctranslate2.Translator(
                MT_CT2_DIR, device=self.device,
                compute_type="int8_float16" if self.device == "cuda" else "int8")
        else:
            dtype = torch.float16 if self.device == "cuda" else torch.float32
            self.mt = AutoModelForSeq2SeqLM.from_pretrained(MT_MODEL, dtype=dtype).to(self.device)
            self.mt.eval()
        self.translate_text("vi", "en", "khởi động")  # warmup
        status_cb(f"San sang (device={self.device}"
                  f"{', MT=ct2' if self.mt_ct2 else ''}). Bam 'Bat dau' va noi vao mic.")

    def _load_asr(self, kind, path, status_cb):
        from faster_whisper import WhisperModel

        key = (kind, path)
        if key in self._asr_cache:
            return self._asr_cache[key]
        name = path.split("/")[-1]
        if kind == "pho":
            from huggingface_hub import snapshot_download
            status_cb(f"Dang tai {name} (lan dau co the mat vai phut)...")
            root = snapshot_download(PHOWHISPER_REPO, allow_patterns=[f"{path}/*"])
            path = os.path.join(root, path)
        status_cb(f"Dang nap ASR ({name}) ...")
        m = WhisperModel(path, device=self.device, compute_type=self._ct)
        list(m.transcribe(np.zeros(SAMPLE_RATE, dtype=np.float32),
                          language="vi", beam_size=1)[0])
        self._asr_cache[key] = m
        return m

    def set_final_model(self, choice, status_cb=print):
        """Doi model ban cuoi luc dang chay. Model 'pho' chi lo tieng Viet."""
        kind, path = ASR_CHOICES[choice]
        with self._lock:
            m = self._load_asr(kind, path, status_cb)
            if kind == "pho":
                self.asr_vi_final, self.asr_en_final = m, self.asr_fast
            else:
                self.asr_vi_final = self.asr_en_final = m
        status_cb(f"Model ban cuoi: {choice}")

    def translate_text(self, src, tgt, text):
        if self.mt_ct2 is not None:
            toks = self.mt_tok.convert_ids_to_tokens(self.mt_tok.encode(f"{src}: {text}"))
            res = self.mt_ct2.translate_batch([toks], beam_size=1, max_decoding_length=256)
            ids = self.mt_tok.convert_tokens_to_ids(res[0].hypotheses[0])
            result = self.mt_tok.decode(ids, skip_special_tokens=True)
        else:
            in_ids = self.mt_tok(f"{src}: {text}", return_tensors="pt").input_ids.to(self.device)
            with torch.no_grad():
                out = self.mt.generate(in_ids, max_length=256, num_beams=1)
            result = self.mt_tok.decode(out[0], skip_special_tokens=True)
        return re.sub(r"^(vi|en):\s*", "", result).strip()

    def _transcribe(self, model, audio, lang, fast=False):
        # vad_filter bo luon: audio da duoc cat bang VAD nang luong o tang mic
        segs, info = model.transcribe(
            audio, language=lang,
            beam_size=1 if fast else 3,
            vad_filter=False,
            condition_on_previous_text=False)
        return " ".join(s.text.strip() for s in segs).strip(), info

    def _pick_lang(self, info, mode):
        src = info.language if mode == "auto" else mode
        if src not in ("vi", "en"):
            probs = dict(info.all_language_probs or [])
            src = "vi" if probs.get("vi", 0) >= probs.get("en", 0) else "en"
        return src

    def process_partial(self, audio, mode="auto", src_hint=None):
        """Ban nhap nhanh khi dang noi: beam 1, model nho."""
        audio = normalize(audio)
        lang = src_hint or (None if mode == "auto" else mode)
        text, info = self._transcribe(self.asr_fast, audio, lang, fast=True)
        if not text or not re.search(r"\w", text):
            return None
        src = lang or self._pick_lang(info, mode)
        tgt = "en" if src == "vi" else "vi"
        translation = self.translate_text(src, tgt, text)
        return {"src": src, "tgt": tgt, "text": text, "translation": translation}

    def process(self, audio, mode="auto", src_hint=None):
        """Ban cuoi chat luong cao khi dut cau. Chon model theo ngon ngu."""
        audio = normalize(audio)
        t0 = time.perf_counter()

        if mode != "auto":
            src = mode
        elif src_hint in ("vi", "en"):
            src = src_hint  # da biet tu cac ban nhap truoc do
        else:
            # cau ngan chua co ban nhap: doan ngon ngu bang model nho
            _, info = self._transcribe(self.asr_fast, audio, None, fast=True)
            src = self._pick_lang(info, mode)

        model = self.asr_vi_final if src == "vi" else self.asr_en_final
        text, info = self._transcribe(model, audio, src)
        t_asr = time.perf_counter() - t0
        if not text or not re.search(r"\w", text):
            return None
        tgt = "en" if src == "vi" else "vi"

        t0 = time.perf_counter()
        translation = self.translate_text(src, tgt, text)
        t_mt = time.perf_counter() - t0
        return {"src": src, "tgt": tgt, "text": text, "translation": translation,
                "t_asr": t_asr, "t_mt": t_mt, "dur": len(audio) / SAMPLE_RATE}


# ----------------------------- VAD + capture -----------------------------

def list_input_devices():
    import sounddevice as sd
    devs = []
    for i, d in enumerate(sd.query_devices()):
        if d["max_input_channels"] > 0 and sd.query_hostapis(d["hostapi"])["name"] == "MME":
            devs.append((i, d["name"]))
    return devs


def pick_best_device(devices, seconds=0.6):
    """Quet nhanh cac mic, chon cai co tin hieu nen manh nhat.

    Ly do: Windows co the dat mac dinh vao endpoint chet (vd 'Microphone'
    rieng le trong khi mic that la 'Microphone Array').
    """
    import sounddevice as sd
    best, best_rms = None, 0.0
    for i, name in devices:
        if "sound mapper" in name.lower():
            continue  # mapper = tro ve mac dinh, khong thu them
        try:
            a = sd.rec(int(seconds * SAMPLE_RATE), samplerate=SAMPLE_RATE,
                       channels=1, dtype="float32", device=i)
            sd.wait()
            rms = float(np.sqrt(np.mean(a ** 2)))
        except Exception:
            continue
        if rms > best_rms:
            best_rms, best = rms, (i, name)
    # tin hieu nen < 1e-4 o moi mic nghia la tat ca deu cam -> tra None
    return best if best_rms >= 1e-4 else None


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
    def __init__(self, asr_choice=None, mobile=False):
        import tkinter as tk
        from tkinter import scrolledtext, ttk

        self.asr_choice = asr_choice or list(ASR_CHOICES)[2]  # mac dinh PhoWhisper-small
        self.mobile = mobile
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

        ttk.Label(devrow, text="  Model:").pack(side="left")
        self.model_var = tk.StringVar(value=self.asr_choice)
        self.model_box = ttk.Combobox(devrow, textvariable=self.model_var,
                                      values=list(ASR_CHOICES), state="readonly", width=34)
        self.model_box.pack(side="left", padx=4)
        self.model_box.bind("<<ComboboxSelected>>", self.change_model)

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
        self.translator = Translator(status_cb=lambda m: self.out_queue.put(("status", m)),
                                     asr_choice=self.asr_choice, mobile=self.mobile)
        # tu chon mic co tin hieu (Windows co the dat mac dinh vao mic chet)
        self.out_queue.put(("status", "Dang quet mic..."))
        best = pick_best_device(self.devices)
        if best:
            self.out_queue.put(("autodev", best))
        self.mic = MicSegmenter(
            self.partial_q, self.final_q,
            level_cb=lambda r, t, s: self.out_queue.put(("level", r / max(t, 1e-6))),
            status_cb=lambda m: self.out_queue.put(("status", m)),
            device=best[0] if best else None)
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
    def change_model(self, _event=None):
        if not self.translator:
            return
        choice = self.model_var.get()
        self.model_box.config(state="disabled")

        def do_swap():
            try:
                self.translator.set_final_model(
                    choice, status_cb=lambda m: self.out_queue.put(("status", m)))
            except Exception as e:
                self.out_queue.put(("status", f"Loi tai model: {e}"))
            finally:
                self.out_queue.put(("model_done", None))

        threading.Thread(target=do_swap, daemon=True).start()

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
                elif kind == "model_done":
                    self.model_box.config(state="readonly")
                elif kind == "autodev":
                    idx, name = data
                    self.dev_var.set(f"[{idx}] {name}")
                    self.status.set(f"Tu chon mic: {name}")
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

def selftest(asr_choice=None, mobile=False):
    """Chay pipeline tren bo audio benchmark, khong can mic/GUI."""
    import json

    bench = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "benchmark")
    with open(os.path.join(bench, "testset.json"), encoding="utf-8") as f:
        testset = json.load(f)

    tr = Translator(asr_choice=asr_choice, mobile=mobile)
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
    parser.add_argument("--asr", choices=list(ASR_FLAG_MAP), default="phowhisper-medium",
                        help="model ASR khoi dong cho ban cuoi (doi duoc trong giao dien)")
    parser.add_argument("--mobile", action="store_true",
                        help="mo phong dien thoai: ep CPU, model base "
                             "(whisper-base + PhoWhisper-base + envit5-ct2)")
    args = parser.parse_args()
    choice = ASR_FLAG_MAP["phowhisper-base"] if args.mobile else ASR_FLAG_MAP[args.asr]
    if args.selftest:
        selftest(asr_choice=choice, mobile=args.mobile)
    else:
        App(asr_choice=choice, mobile=args.mobile).run()
