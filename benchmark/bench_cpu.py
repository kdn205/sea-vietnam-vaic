# -*- coding: utf-8 -*-
"""Do latency CPU-only (mo phong dieu kien dien thoai) cho ASR + MT."""
import json
import os
import sys
import time

import numpy as np

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))

import av  # noqa: E402


def load_audio(path, sr=16000):
    container = av.open(path)
    resampler = av.AudioResampler(format="s16", layout="mono", rate=sr)
    chunks = []
    for frame in container.decode(audio=0):
        for rf in resampler.resample(frame):
            chunks.append(rf.to_ndarray().flatten())
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def main():
    with open(os.path.join(HERE, "testset.json"), encoding="utf-8") as f:
        testset = json.load(f)
    audios = {t["id"]: load_audio(t["audio"]) for t in testset}

    from faster_whisper import WhisperModel

    print("=== ASR CPU int8 (beam 3), 4 luong ===")
    for name, repo in [("whisper-base", "Systran/faster-whisper-base"),
                       ("whisper-small", "Systran/faster-whisper-small")]:
        m = WhisperModel(repo, device="cpu", compute_type="int8", cpu_threads=4)
        list(m.transcribe(np.zeros(16000, dtype=np.float32), language="vi", beam_size=1)[0])
        lats, durs = [], []
        for t in testset:
            a = audios[t["id"]]
            t0 = time.perf_counter()
            segs, info = m.transcribe(a, language=t["lang"], beam_size=3,
                                      vad_filter=False, condition_on_previous_text=False)
            text = " ".join(s.text.strip() for s in segs)
            lats.append(time.perf_counter() - t0)
            durs.append(len(a) / 16000)
        print(f"{name:>15}: TB {sum(lats)/len(lats):.2f}s/cau | RTF {sum(lats)/sum(durs):.2f}")
        del m

    print("\n=== MT envit5-CT2 int8 CPU (beam 1), 4 luong ===")
    import ctranslate2
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained("VietAI/envit5-translation")
    tr = ctranslate2.Translator(os.path.join(HERE, "..", "models", "envit5-ct2"),
                                device="cpu", compute_type="int8", inter_threads=1, intra_threads=4)
    lats = []
    for t in testset:
        prefix = t["lang"]
        t0 = time.perf_counter()
        toks = tok.convert_ids_to_tokens(tok.encode(f"{prefix}: {t['text_ref']}"))
        res = tr.translate_batch([toks], beam_size=1, max_decoding_length=256)
        _ = tok.decode(tok.convert_tokens_to_ids(res[0].hypotheses[0]), skip_special_tokens=True)
        lats.append(time.perf_counter() - t0)
    print(f"envit5-ct2 CPU: TB {sum(lats)/len(lats):.2f}s/cau")


if __name__ == "__main__":
    main()
