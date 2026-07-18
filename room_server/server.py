# -*- coding: utf-8 -*-
"""
Room dich hop offline: laptop lam hub, dien thoai join bang trinh duyet.

Kien truc:
  Dien thoai (web) --mic PCM--> server: VAD -> ASR (zipformer vi/en theo
  ngon ngu nguoi noi) -> MT (envit5-ct2) -> broadcast text goc + ban dich
  cho TAT CA thanh vien trong room.

Chay:
  python make_cert.py        (mot lan duy nhat)
  python server.py           (in ra URL de dien thoai join qua hotspot)
"""
import asyncio
import json
import os
import queue
import re
import socket
import sys
import threading
import time

import numpy as np

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "..", "models")

SAMPLE_RATE = 16000
SILENCE_END_S = 0.45      # im lang -> ket thuc cau
PREROLL_S = 0.3
PARTIAL_EVERY_S = 0.3     # nhip cap nhat ban nhap (zipformer du nhanh)
MIN_SPEECH_S = 0.35
MAX_SPEECH_S = 15.0

ZIP_VI = os.path.join(MODELS, "sherpa-onnx-zipformer-vi-int8-2025-04-20")
ZIP_EN = os.path.join(MODELS, "sherpa-onnx-zipformer-gigaspeech-2023-12-12")
ENVIT5_CT2 = os.path.join(MODELS, "envit5-ct2")


# ----------------------------- Engines -----------------------------

class Engines:
    def __init__(self):
        import ctranslate2
        import sherpa_onnx
        from transformers import AutoTokenizer

        print("Nap zipformer-vi ...")
        self.asr = {
            "vi": sherpa_onnx.OfflineRecognizer.from_transducer(
                encoder=os.path.join(ZIP_VI, "encoder-epoch-12-avg-8.int8.onnx"),
                decoder=os.path.join(ZIP_VI, "decoder-epoch-12-avg-8.onnx"),
                joiner=os.path.join(ZIP_VI, "joiner-epoch-12-avg-8.int8.onnx"),
                tokens=os.path.join(ZIP_VI, "tokens.txt"),
                num_threads=4, decoding_method="greedy_search"),
        }
        print("Nap zipformer-en ...")
        self.asr["en"] = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=os.path.join(ZIP_EN, "encoder-epoch-30-avg-1.int8.onnx"),
            decoder=os.path.join(ZIP_EN, "decoder-epoch-30-avg-1.onnx"),
            joiner=os.path.join(ZIP_EN, "joiner-epoch-30-avg-1.int8.onnx"),
            tokens=os.path.join(ZIP_EN, "tokens.txt"),
            num_threads=4, decoding_method="greedy_search")
        print("Nap envit5-ct2 ...")
        self.mt_tok = AutoTokenizer.from_pretrained("VietAI/envit5-translation")
        self.mt = ctranslate2.Translator(ENVIT5_CT2, device="cpu",
                                         compute_type="int8", intra_threads=4)
        self.translate("vi", "khởi động")
        print("Engines san sang.")

    def recognize(self, lang, audio):
        peak = float(np.abs(audio).max())
        if 0 < peak < 0.5:
            audio = audio * min(0.9 / peak, 60.0)
        rec = self.asr[lang]
        s = rec.create_stream()
        s.accept_waveform(SAMPLE_RATE, audio)
        rec.decode_stream(s)
        text = s.result.text.strip()
        # zipformer tra ve CHU HOA het -> ve dang cau thuong cho de doc
        if lang == "vi" and text.isupper():
            text = text.lower().capitalize()
        elif text.isupper():
            text = text.lower().capitalize()
        return text

    def translate(self, src, text):
        toks = self.mt_tok.convert_ids_to_tokens(self.mt_tok.encode(f"{src}: {text}"))
        res = self.mt.translate_batch([toks], beam_size=1, max_decoding_length=256)
        ids = self.mt_tok.convert_tokens_to_ids(res[0].hypotheses[0])
        out = self.mt_tok.decode(ids, skip_special_tokens=True)
        return re.sub(r"^(vi|en):\s*", "", out).strip()


# ----------------------------- Room state -----------------------------

class Client:
    def __init__(self, ws, name, lang):
        self.ws = ws
        self.name = name
        self.lang = lang            # "vi" | "en" (ngon ngu NGUOI NAY noi)
        self.buf = []               # cac chunk cua cau dang noi
        self.preroll = []
        self.preroll_s = 0.0
        self.speaking = False
        self.silence_s = 0.0
        self.speech_s = 0.0
        self.since_partial_s = 0.0
        self.noise = []             # do nhieu nen de chinh nguong
        self.threshold = 0.0015
        self.utt = 0
        self.last_level_t = 0.0     # lan cuoi gui level ve client

    @property
    def uid(self):
        return f"{self.name}#{self.utt}"


class Room:
    """Ket noi WS + hang doi xu ly. final khong bao gio bi bo, partial latest-wins."""

    def __init__(self):
        self.clients = {}           # ws -> Client
        self.lock = threading.Lock()
        self.final_q = queue.Queue()
        self.partials = {}          # client name -> (audio, Client, utt)
        self.loop = None            # asyncio loop (gan khi server start)

    async def broadcast(self, msg: dict):
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_text(json.dumps(msg, ensure_ascii=False))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.pop(ws, None)

    def broadcast_threadsafe(self, msg):
        if self.loop:
            asyncio.run_coroutine_threadsafe(self.broadcast(msg), self.loop)

    def roster(self):
        return [{"name": c.name, "lang": c.lang} for c in self.clients.values()]


ROOM = Room()
ENGINES: Engines = None


# ----------------------------- VAD per client -----------------------------

def feed_audio(c: Client, chunk: np.ndarray):
    """Nhan 1 chunk PCM tu client, cat cau bang VAD nang luong."""
    dur = len(chunk) / SAMPLE_RATE
    rms = float(np.sqrt(np.mean(chunk ** 2))) if len(chunk) else 0.0

    # 0.6s dau: do nhieu nen
    if len(c.noise) < 15:
        c.noise.append(rms)
        if len(c.noise) == 15:
            # he so 2.5 + tran 0.008: mic nong/nhieu nen cao khong day nguong
            # vuot qua muc giong noi thu xa (~0.01)
            c.threshold = min(max(0.0012, float(np.median(c.noise)) * 2.5), 0.008)
        return

    # gui muc tin hieu ve rieng client nay ~5 lan/s de hien thanh level
    now = time.time()
    if now - c.last_level_t > 0.2:
        c.last_level_t = now
        if ROOM.loop:
            asyncio.run_coroutine_threadsafe(
                _send_level(c, rms), ROOM.loop)

    if not c.speaking:
        c.preroll.append(chunk)
        c.preroll_s += dur
        while c.preroll_s > PREROLL_S and len(c.preroll) > 1:
            c.preroll_s -= len(c.preroll[0]) / SAMPLE_RATE
            c.preroll.pop(0)
        if rms > c.threshold:
            c.speaking = True
            c.utt += 1
            c.buf = list(c.preroll)
            c.speech_s = c.silence_s = c.since_partial_s = 0.0
    else:
        c.buf.append(chunk)
        c.speech_s += dur
        c.since_partial_s += dur
        # hysteresis: nguong ket thuc cau thap hon nguong bat dau -> giong noi
        # xa mic luc chim luc noi khong bi cat cau vun
        c.silence_s = c.silence_s + dur if rms < c.threshold * 0.35 else 0.0

        if c.since_partial_s >= PARTIAL_EVERY_S:
            c.since_partial_s = 0.0
            with ROOM.lock:
                ROOM.partials[c.name] = (np.concatenate(c.buf), c, c.utt)

        if c.silence_s >= SILENCE_END_S or c.speech_s >= MAX_SPEECH_S:
            audio = np.concatenate(c.buf)
            with ROOM.lock:
                ROOM.partials.pop(c.name, None)
            if c.speech_s - c.silence_s >= MIN_SPEECH_S:
                ROOM.final_q.put((audio, c, c.utt))
            c.speaking = False
            c.buf, c.preroll, c.preroll_s = [], [], 0.0


async def _send_level(c: Client, rms: float):
    try:
        await c.ws.send_text(json.dumps(
            {"type": "level", "ratio": round(rms / max(c.threshold, 1e-6), 2),
             "speaking": c.speaking}))
    except Exception:
        pass


# ----------------------------- Worker -----------------------------

def worker():
    last_partial = {}   # client name -> (text, translation) de khoi dich lai nhap trung
    while True:
        kind = None
        try:
            audio, c, utt = ROOM.final_q.get(timeout=0.05)
            kind = "final"
        except queue.Empty:
            with ROOM.lock:
                if ROOM.partials:
                    name = next(iter(ROOM.partials))
                    audio, c, utt = ROOM.partials.pop(name)
                    kind = "partial"
        if kind is None:
            continue
        try:
            t0 = time.perf_counter()
            text = ENGINES.recognize(c.lang, audio)
            t_asr = time.perf_counter() - t0
            # bo ket qua rong hoac rac 1 ky tu ("A", "I" do tieng on kich hoat VAD)
            if not text or len(re.sub(r"[^\w]", "", text)) <= 1:
                if kind == "final":
                    ROOM.broadcast_threadsafe({"type": "drop", "id": f"{c.name}#{utt}"})
                continue
            prev = last_partial.get(c.name)
            if kind == "partial" and prev and prev[0] == text:
                continue  # nhap khong doi -> khoi broadcast lai
            t0 = time.perf_counter()
            translation = ENGINES.translate(c.lang, text)
            t_mt = time.perf_counter() - t0
            if kind == "partial":
                last_partial[c.name] = (text, translation)
            else:
                last_partial.pop(c.name, None)
            ROOM.broadcast_threadsafe({
                "type": kind, "id": f"{c.name}#{utt}", "name": c.name,
                "lang": c.lang, "text": text, "translation": translation,
                "t_asr": round(t_asr, 2), "t_mt": round(t_mt, 2),
                "dur": round(len(audio) / SAMPLE_RATE, 1),
            })
        except Exception as e:
            print(f"Loi worker: {type(e).__name__}: {e}")


# ----------------------------- FastAPI -----------------------------

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402

app = FastAPI()


@app.get("/")
async def index():
    return FileResponse(os.path.join(HERE, "index.html"))


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    client = None
    try:
        while True:
            msg = await ws.receive()
            if msg.get("text") is not None:
                data = json.loads(msg["text"])
                if data.get("type") == "join":
                    name = (data.get("name") or "khach").strip()[:20]
                    lang = data.get("lang") if data.get("lang") in ("vi", "en") else "vi"
                    client = Client(ws, name, lang)
                    ROOM.clients[ws] = client
                    await ROOM.broadcast({"type": "roster", "members": ROOM.roster()})
                    print(f"+ {name} ({lang}) vao room ({len(ROOM.clients)} nguoi)")
            elif msg.get("bytes") is not None and client is not None:
                chunk = np.frombuffer(msg["bytes"], dtype=np.float32)
                feed_audio(client, chunk)
            elif msg.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        c = ROOM.clients.pop(ws, None)
        if c:
            print(f"- {c.name} roi room ({len(ROOM.clients)} nguoi)")
            await ROOM.broadcast({"type": "roster", "members": ROOM.roster()})


@app.on_event("startup")
async def startup():
    ROOM.loop = asyncio.get_running_loop()


def local_ips():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                ips.add(ip)
    except socket.gaierror:
        pass
    return sorted(ips) or ["<IP-cua-laptop>"]


def main():
    global ENGINES
    ENGINES = Engines()
    threading.Thread(target=worker, daemon=True).start()

    import uvicorn
    cert = os.path.join(HERE, "cert.pem")
    key = os.path.join(HERE, "key.pem")
    has_ssl = os.path.exists(cert) and os.path.exists(key)
    port = 8443 if has_ssl else 8000
    scheme = "https" if has_ssl else "http"

    print("\n" + "=" * 60)
    print("ROOM DICH HOP OFFLINE — dien thoai mo trinh duyet toi:")
    for ip in local_ips():
        print(f"    {scheme}://{ip}:{port}")
    print("(dien thoai phai cung mang Wi-Fi/hotspot voi laptop;")
    print(" trinh duyet canh bao cert tu ky -> bam Advanced > Proceed)")
    print("=" * 60 + "\n")

    kwargs = {"host": "0.0.0.0", "port": port, "log_level": "warning"}
    if has_ssl:
        kwargs.update(ssl_certfile=cert, ssl_keyfile=key)
    uvicorn.run(app, **kwargs)


if __name__ == "__main__":
    main()
