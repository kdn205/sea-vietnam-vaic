# -*- coding: utf-8 -*-
"""Benchmark sherpa-onnx zipformer-vi int8 tren bo test tieng Viet."""
import json
import os
import re
import sys
import time

import numpy as np

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "..", "models", "sherpa-onnx-zipformer-vi-int8-2025-04-20")

from bench_cpu import load_audio  # noqa: E402


def norm_text(s):
    s = s.lower()
    s = re.sub(r"[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def main():
    import jiwer
    import sherpa_onnx

    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=os.path.join(MODEL_DIR, "encoder-epoch-12-avg-8.int8.onnx"),
        decoder=os.path.join(MODEL_DIR, "decoder-epoch-12-avg-8.onnx"),
        joiner=os.path.join(MODEL_DIR, "joiner-epoch-12-avg-8.int8.onnx"),
        tokens=os.path.join(MODEL_DIR, "tokens.txt"),
        num_threads=4,
        decoding_method="greedy_search",
    )

    with open(os.path.join(HERE, "testset.json"), encoding="utf-8") as f:
        testset = [t for t in json.load(f) if t["lang"] == "vi"]

    hyps, refs, lats, durs = [], [], [], []
    for t in testset:
        audio = load_audio(t["audio"])
        t0 = time.perf_counter()
        s = rec.create_stream()
        s.accept_waveform(16000, audio)
        rec.decode_stream(s)
        text = s.result.text
        lats.append(time.perf_counter() - t0)
        durs.append(len(audio) / 16000)
        hyps.append(text)
        refs.append(t["text_ref"])
        print(f"[{t['id']}] {lats[-1]:.2f}s | {text}")

    wer = jiwer.wer([norm_text(r) for r in refs], [norm_text(h) for h in hyps]) * 100
    print(f"\nzipformer-vi int8 CPU: WER {wer:.1f}% | TB {sum(lats)/len(lats):.2f}s/cau "
          f"| RTF {sum(lats)/sum(durs):.3f}")


if __name__ == "__main__":
    main()
