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
SILENCE_END_S = 0.55      # im lang -> ket thuc cau
MERGE_WINDOW_S = 4.0      # cung nguoi noi tiep trong N giay -> noi vao cau truoc
MERGE_MAX_WORDS = 60      # tran do dai cau da gop
PREROLL_S = 0.3
PARTIAL_EVERY_S = 0.3     # nhip cap nhat ban nhap (zipformer du nhanh)
MIN_SPEECH_S = 0.35
MAX_SPEECH_S = 15.0

ZIP_VI = os.path.join(MODELS, "sherpa-onnx-zipformer-vi-int8-2025-04-20")
ZIP_EN = os.path.join(MODELS, "sherpa-onnx-zipformer-gigaspeech-2023-12-12")
ENVIT5_CT2 = os.path.join(MODELS, "envit5-ct2")
ENVIT5_CT2_F32 = os.path.join(MODELS, "envit5-ct2-f32")
SUM_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"   # tom tat cuoi hop, chay local, khong can API


# ----------------------------- Engines -----------------------------

class Engines:
    def __init__(self, mt_precision="int8"):
        import ctranslate2
        import sherpa_onnx
        from transformers import AutoTokenizer

        self.mt_precision = mt_precision
        mt_dir = ENVIT5_CT2_F32 if mt_precision == "float32" else ENVIT5_CT2
        mt_ct_gpu = "float32" if mt_precision == "float32" else "int8_float16"
        mt_ct_cpu = "float32" if mt_precision == "float32" else "int8"

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
        # uu tien GPU cho tang dich de danh CPU cho ASR (nhieu nguoi noi cung luc)
        self.mt = None
        try:
            import torch
            lib = os.path.join(os.path.dirname(torch.__file__), "lib")
            if os.path.isdir(lib):
                os.add_dll_directory(lib)
            if torch.cuda.is_available():
                self.mt = ctranslate2.Translator(mt_dir, device="cuda",
                                                 compute_type=mt_ct_gpu)
                self.translate("vi", "khởi động")
                print(f"MT chay tren GPU ({mt_precision}).")
        except Exception as e:
            print(f"MT GPU khong dung duoc ({type(e).__name__}) -> CPU")
            self.mt = None
        if self.mt is None:
            self.mt = ctranslate2.Translator(mt_dir, device="cpu",
                                             compute_type=mt_ct_cpu, intra_threads=4)
            self.translate("vi", "khởi động")
        print(f"Engines san sang (MT={mt_precision}).")

    def recognize_batch(self, lang, audios):
        """Nhan dang NHIEU doan audio cung ngon ngu trong 1 lan decode."""
        rec = self.asr[lang]
        streams = []
        for audio in audios:
            peak = float(np.abs(audio).max())
            if 0 < peak < 0.5:
                audio = audio * min(0.9 / peak, 60.0)
            s = rec.create_stream()
            s.accept_waveform(SAMPLE_RATE, audio)
            streams.append(s)
        if len(streams) == 1 or not hasattr(rec, "decode_streams"):
            for s in streams:
                rec.decode_stream(s)
        else:
            rec.decode_streams(streams)
        out = []
        for s in streams:
            text = s.result.text.strip()
            # zipformer tra ve CHU HOA het -> ve dang cau thuong cho de doc
            if text.isupper():
                text = text.lower().capitalize()
            out.append(text)
        return out

    def translate_pairs(self, pairs, beam_size=1):
        """Dich NHIEU cau (src_lang, text) trong 1 lan goi batch."""
        toks = [self.mt_tok.convert_ids_to_tokens(self.mt_tok.encode(f"{s}: {t}"))
                for s, t in pairs]
        res = self.mt.translate_batch(toks, beam_size=beam_size, max_decoding_length=256)
        outs = []
        for r in res:
            ids = self.mt_tok.convert_tokens_to_ids(r.hypotheses[0])
            out = self.mt_tok.decode(ids, skip_special_tokens=True)
            outs.append(re.sub(r"^(vi|en):\s*", "", out).strip())
        return outs

    def translate(self, src, text):
        return self.translate_pairs([(src, text)])[0]


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
        self.cur_ratio = 0.0        # muc tin hieu hien tai / nguong (de so ai troi hon)

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
        self.history = []           # cac cau final da chot (bien ban hop)
        self.started = time.strftime("%Y-%m-%d %H:%M")
        self.log_path = os.path.join(
            HERE, "logs", f"hop_{time.strftime('%Y%m%d_%H%M%S')}.jsonl")
        self.empty_since = None     # thoi diem room trong (de tu mo phien moi)

    EMPTY_RESET_S = 120  # room trong qua 2 phut -> cuoc hop moi, xoa bien ban cu

    def new_session(self):
        self.history = []
        self.started = time.strftime("%Y-%m-%d %H:%M")
        self.log_path = os.path.join(
            HERE, "logs", f"hop_{time.strftime('%Y%m%d_%H%M%S')}.jsonl")
        print("Phien hop moi (room trong qua lau, bien ban cu da luu trong logs/)")

    def log_final(self, entry):
        self.history.append(entry)
        try:
            os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError:
            pass

    def remove_final(self, uid):
        """Xoa cau bi dedup (ban nghe ke) khoi bien ban."""
        self.history[:] = [h for h in self.history if h["id"] != uid]

    def update_final(self, uid, **fields):
        """Cap nhat cau da gop them doan noi tiep."""
        for h in self.history:
            if h["id"] == uid:
                h.update(fields)
                return True
        return False

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

    c.cur_ratio = 0.6 * c.cur_ratio + 0.4 * (rms / max(c.threshold, 1e-6))

    if not c.speaking:
        c.preroll.append(chunk)
        c.preroll_s += dur
        while c.preroll_s > PREROLL_S and len(c.preroll) > 1:
            c.preroll_s -= len(c.preroll[0]) / SAMPLE_RATE
            c.preroll.pop(0)
        if rms > c.threshold:
            # cong "ai troi hon": neu co nguoi khac dang noi voi tin hieu manh
            # gap doi tro len -> day chi la giong ho lot sang mic minh, bo qua
            others = [o.cur_ratio for o in ROOM.clients.values()
                      if o is not c and o.speaking]
            if others and c.cur_ratio < 0.5 * max(others):
                return
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
            forced = c.speech_s >= MAX_SPEECH_S  # bi cat cuong buc giua chung
            audio = np.concatenate(c.buf)
            # cat duoi im lang (giu 0.15s): decode nhanh hon va tranh ASR
            # ao giac them tu vao khoang lang cuoi cau
            cut = int(max(0.0, c.silence_s - 0.15) * SAMPLE_RATE)
            if 0 < cut < len(audio):
                audio = audio[:-cut]
            with ROOM.lock:
                ROOM.partials.pop(c.name, None)
            if c.speech_s - c.silence_s >= MIN_SPEECH_S:
                ROOM.final_q.put((audio, c, c.utt, forced))
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

def _too_similar(a, b):
    import difflib
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio() > 0.65


def worker():
    """Gom TAT CA nguoi dang cho vao mot batch: nhieu nguoi noi cung luc
    thi chi phi ~1.4x mot nguoi thay vi Nx (ASR decode_streams + MT batch)."""
    last_partial = {}   # client name -> text nhap gan nhat (bo dich lai nhap trung)
    recent_finals = []  # (timestamp, name, text, rms, id) de loc cau "nghe ke"
    last_final = {}     # client name -> cau chot gan nhat (de gop cau noi tiep)
    while True:
        jobs = []  # (kind, audio, client, utt, forced)
        try:
            audio, c, utt, forced = ROOM.final_q.get(timeout=0.05)
            jobs.append(["final", audio, c, utt, forced])
        except queue.Empty:
            pass
        while True:  # vet not cac final dang doi
            try:
                audio, c, utt, forced = ROOM.final_q.get_nowait()
                jobs.append(["final", audio, c, utt, forced])
            except queue.Empty:
                break
        with ROOM.lock:  # lay ban nhap moi nhat cua moi nguoi
            for name in list(ROOM.partials):
                audio, c, utt = ROOM.partials.pop(name)
                jobs.append(["partial", audio, c, utt, False])
        if not jobs:
            continue
        try:
            # --- ASR theo tung nhom ngon ngu, moi nhom 1 lan decode batch ---
            t0 = time.perf_counter()
            texts = [None] * len(jobs)
            for lang in ("vi", "en"):
                idxs = [i for i, j in enumerate(jobs) if j[2].lang == lang]
                if idxs:
                    results = ENGINES.recognize_batch(lang, [jobs[i][1] for i in idxs])
                    for i, t in zip(idxs, results):
                        texts[i] = t
            t_asr = round((time.perf_counter() - t0) / len(jobs), 2)

            # --- loc rac + nhap trung + "nghe ke" + GOP cau noi tiep ---
            now = time.time()
            recent_finals[:] = [r for r in recent_finals if now - r[0] < 5.0]
            keep = []  # (kind, client, utt, out_text, out_id, drop_id, out_dur, forced)
            for i, (kind, audio, c, utt, forced) in enumerate(jobs):
                text = texts[i]
                dur = round(len(audio) / SAMPLE_RATE, 1)
                if not text or len(re.sub(r"[^\w]", "", text)) <= 1:
                    if kind == "final":
                        ROOM.broadcast_threadsafe({"type": "drop", "id": f"{c.name}#{utt}"})
                    continue
                if kind == "partial":
                    if last_partial.get(c.name) == text:
                        continue
                    keep.append((kind, c, utt, text, f"{c.name}#{utt}", None, dur, False))
                    continue

                # 2 mic ra cau gan giong nhau = 1 nguoi noi lot vao mic hang xom
                # -> GIU BAN TIN HIEU MANH HON (bat ke den truoc hay sau)
                rms = float(np.sqrt(np.mean(audio ** 2)))
                dup = next((r for r in recent_finals
                            if r[1] != c.name and _too_similar(r[2], text)), None)
                if dup is not None:
                    if rms <= dup[3]:
                        ROOM.broadcast_threadsafe(
                            {"type": "drop", "id": f"{c.name}#{utt}"})
                        continue
                    ROOM.broadcast_threadsafe({"type": "drop", "id": dup[4]})
                    ROOM.remove_final(dup[4])
                    recent_finals.remove(dup)

                # GOP: cung nguoi noi tiep ngay (hoac cau truoc bi cat cuong buc)
                # -> noi vao cau truoc va DICH LAI toan bo de giu ngu canh
                lf = last_final.get(c.name)
                merged = (lf is not None
                          and (now - lf["t"] <= MERGE_WINDOW_S or lf["forced"])
                          and len((lf["text"] + " " + text).split()) <= MERGE_MAX_WORDS)
                if merged:
                    out_id, out_text = lf["id"], lf["text"] + " " + text
                    drop_id, out_dur = f"{c.name}#{utt}", round(lf["dur"] + dur, 1)
                else:
                    out_id, out_text, drop_id, out_dur = f"{c.name}#{utt}", text, None, dur
                recent_finals.append((now, c.name, out_text, rms, out_id))
                keep.append((kind, c, utt, out_text, out_id, drop_id, out_dur, forced))
            if not keep:
                continue

            # --- MT: ban chot beam 4 (chat luong), ban nhap beam 1 (toc do) ---
            t0 = time.perf_counter()
            translations = [None] * len(keep)
            for beam, kinds in ((4, ("final",)), (1, ("partial",))):
                idxs = [i for i, k in enumerate(keep) if k[0] in kinds]
                if idxs:
                    outs = ENGINES.translate_pairs(
                        [(keep[i][1].lang, keep[i][3]) for i in idxs], beam_size=beam)
                    for i, o in zip(idxs, outs):
                        translations[i] = o
            t_mt = round((time.perf_counter() - t0) / len(keep), 2)

            for (kind, c, utt, text, out_id, drop_id, dur, forced), translation \
                    in zip(keep, translations):
                if kind == "partial":
                    last_partial[c.name] = text
                else:
                    last_partial.pop(c.name, None)
                    entry = {
                        "id": out_id, "time": time.strftime("%H:%M:%S"),
                        "name": c.name, "lang": c.lang,
                        "text": text, "translation": translation,
                        "t_asr": t_asr, "t_mt": t_mt, "dur": dur,
                    }
                    # cau gop: cap nhat entry cu trong bien ban thay vi them moi
                    if drop_id is None or not ROOM.update_final(out_id, **entry):
                        ROOM.log_final(entry)
                    if drop_id:
                        ROOM.broadcast_threadsafe({"type": "drop", "id": drop_id})
                    last_final[c.name] = {"id": out_id, "text": text, "t": time.time(),
                                          "dur": dur, "forced": forced}
                ROOM.broadcast_threadsafe({
                    "type": kind, "id": out_id, "name": c.name,
                    "lang": c.lang, "text": text, "translation": translation,
                    "t_asr": t_asr, "t_mt": t_mt, "dur": dur,
                })
        except Exception as e:
            print(f"Loi worker: {type(e).__name__}: {e}")


# ----------------------------- Tom tat (LLM local, lazy-load) -----------------------------

_sum = {"model": None, "tok": None}
_sum_lock = threading.Lock()


def _load_summarizer():
    if _sum["model"] is not None:
        return
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    ROOM.broadcast_threadsafe({"type": "sum_status",
                               "text": "Đang nạp model tóm tắt (lần đầu ~20s)..."})
    tok = AutoTokenizer.from_pretrained(SUM_MODEL)
    try:
        if not torch.cuda.is_available():
            raise RuntimeError("no cuda")
        model = AutoModelForCausalLM.from_pretrained(
            SUM_MODEL, dtype=torch.float16).to("cuda")
    except Exception:
        model = AutoModelForCausalLM.from_pretrained(SUM_MODEL, dtype=torch.float32)
    model.eval()
    _sum.update(model=model, tok=tok)


def summarize_history():
    """Tom tat bien ban bang LLM local (mot lan cuoi hop, khong can realtime)."""
    import torch

    with _sum_lock:
        _load_summarizer()
        lines = "\n".join(
            f"[{h['time']}] {h['name']} ({h['lang'].upper()}): {h['text']}"
            for h in ROOM.history)
        messages = [
            {"role": "system", "content":
             "Bạn là thư ký cuộc họp kinh doanh song ngữ Việt-Anh. "
             "Chỉ dựa vào nội dung transcript, không bịa thêm."},
            {"role": "user", "content":
             f"Transcript cuộc họp:\n{lines}\n\n"
             "Hãy viết biên bản tóm tắt gồm 2 phần:\n"
             "## Tóm tắt (Tiếng Việt)\n- Chủ đề chính\n- Các quyết định\n- Việc cần làm\n"
             "## Summary (English)\n- Main topics\n- Decisions\n- Action items\n"
             "Ngắn gọn, gạch đầu dòng."},
        ]
        tok, model = _sum["tok"], _sum["model"]
        ids = tok.apply_chat_template(messages, add_generation_prompt=True,
                                      return_tensors="pt").to(model.device)
        with torch.no_grad():
            out = model.generate(ids, max_new_tokens=500, do_sample=False,
                                 temperature=None, top_p=None, top_k=None)
        return tok.decode(out[0][ids.shape[1]:], skip_special_tokens=True).strip()


def build_transcript_md():
    lines = [f"# Biên bản họp — {ROOM.started}",
             f"Thành viên: {', '.join(sorted({h['name'] for h in ROOM.history}))}", ""]
    for h in ROOM.history:
        flag = "VN" if h["lang"] == "vi" else "EN"
        lines.append(f"**[{h['time']}] {h['name']} [{flag}]**: {h['text']}")
        lines.append(f"> {h['translation']}")
        lines.append("")
    return "\n".join(lines)


# ----------------------------- FastAPI -----------------------------

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.responses import FileResponse, Response  # noqa: E402

app = FastAPI()


@app.get("/")
async def index():
    return FileResponse(os.path.join(HERE, "index.html"))


@app.get("/transcript")
async def transcript():
    if not ROOM.history:
        return Response("Chua co noi dung.", media_type="text/plain; charset=utf-8")
    return Response(
        build_transcript_md(), media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition":
                 f'attachment; filename="bien-ban-hop-{time.strftime("%Y%m%d-%H%M")}.md"'})


@app.post("/new-session")
async def new_session_endpoint():
    """Bat dau cuoc hop moi: luu bien ban cu vao logs/, xoa man hinh moi may."""
    ROOM.new_session()
    await ROOM.broadcast({"type": "session_reset"})
    return {"ok": True}


@app.post("/summary")
async def summary_endpoint():
    if not ROOM.history:
        return {"error": "Chưa có nội dung để tóm tắt."}
    try:
        text = await asyncio.to_thread(summarize_history)
    except Exception as e:
        return {"error": f"Lỗi tóm tắt: {type(e).__name__}: {e}"}
    await ROOM.broadcast({"type": "summary", "text": text,
                          "time": time.strftime("%H:%M:%S")})
    return {"ok": True, "text": text}


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
                    # room trong qua lau -> coi la cuoc hop moi
                    if (not ROOM.clients and ROOM.empty_since
                            and time.time() - ROOM.empty_since > Room.EMPTY_RESET_S):
                        ROOM.new_session()
                    ROOM.empty_since = None
                    client = Client(ws, name, lang)
                    ROOM.clients[ws] = client
                    await ROOM.broadcast({"type": "roster", "members": ROOM.roster()})
                    # phat lai cac cau gan nhat de nguoi vao sau thay ngu canh
                    for h in ROOM.history[-30:]:
                        await ws.send_text(json.dumps(
                            {"type": "final", **h}, ensure_ascii=False))
                    print(f"+ {name} ({lang}) vao room ({len(ROOM.clients)} nguoi)")
            elif msg.get("bytes") is not None and client is not None:
                # client gui PCM int16 (tiet kiem 1 nua bang thong so voi float32)
                chunk = np.frombuffer(msg["bytes"], dtype=np.int16).astype(np.float32) / 32768.0
                feed_audio(client, chunk)
            elif msg.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        c = ROOM.clients.pop(ws, None)
        if c:
            print(f"- {c.name} roi room ({len(ROOM.clients)} nguoi)")
            if not ROOM.clients:
                ROOM.empty_since = time.time()
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
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mt", choices=["int8", "float32"], default="int8",
                        help="do chinh xac model dich (int8 nhanh/nhe, float32 de doi chieu)")
    args = parser.parse_args()
    ENGINES = Engines(mt_precision=args.mt)
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
