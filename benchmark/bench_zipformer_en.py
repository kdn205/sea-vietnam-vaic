# -*- coding: utf-8 -*-
"""Benchmark sherpa-onnx zipformer-gigaspeech (tieng Anh) tren bo test."""
import json
import os
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "..", "models", "sherpa-onnx-zipformer-gigaspeech-2023-12-12")

from bench_cpu import load_audio  # noqa: E402
from bench_zipformer import norm_text  # noqa: E402


def main():
    import jiwer
    import sherpa_onnx

    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=os.path.join(MODEL_DIR, "encoder-epoch-30-avg-1.int8.onnx"),
        decoder=os.path.join(MODEL_DIR, "decoder-epoch-30-avg-1.onnx"),
        joiner=os.path.join(MODEL_DIR, "joiner-epoch-30-avg-1.int8.onnx"),
        tokens=os.path.join(MODEL_DIR, "tokens.txt"),
        num_threads=4,
        decoding_method="greedy_search",
    )

    with open(os.path.join(HERE, "testset.json"), encoding="utf-8") as f:
        testset = [t for t in json.load(f) if t["lang"] == "en"]

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
    print(f"\nzipformer-en int8 CPU: WER {wer:.1f}% | TB {sum(lats)/len(lats):.2f}s/cau "
          f"| RTF {sum(lats)/sum(durs):.3f}")


if __name__ == "__main__":
    main()
