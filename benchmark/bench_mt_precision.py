# -*- coding: utf-8 -*-
"""So sanh envit5-CT2 int8 vs float16 vs float32 (chat luong + toc do)."""
import json
import os
import re
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "..", "models")

import torch  # noqa: E402

_lib = os.path.join(os.path.dirname(torch.__file__), "lib")
if os.path.isdir(_lib):
    os.add_dll_directory(_lib)

import ctranslate2  # noqa: E402
import sacrebleu  # noqa: E402
from transformers import AutoTokenizer  # noqa: E402

CONFIGS = [
    ("int8_float16 (dang dung)", os.path.join(MODELS, "envit5-ct2"), "int8_float16"),
    ("float16", os.path.join(MODELS, "envit5-ct2-f32"), "float16"),
    ("float32", os.path.join(MODELS, "envit5-ct2-f32"), "float32"),
]


def main():
    with open(os.path.join(HERE, "testset.json"), encoding="utf-8") as f:
        testset = json.load(f)
    tok = AutoTokenizer.from_pretrained("VietAI/envit5-translation")
    device = "cuda" if torch.cuda.is_available() else "cpu"

    for name, path, ctype in CONFIGS:
        tr = ctranslate2.Translator(path, device=device, compute_type=ctype)

        def translate(src, text):
            toks = tok.convert_ids_to_tokens(tok.encode(f"{src}: {text}"))
            res = tr.translate_batch([toks], beam_size=1, max_decoding_length=256)
            ids = tok.convert_tokens_to_ids(res[0].hypotheses[0])
            return re.sub(r"^(vi|en):\s*", "",
                          tok.decode(ids, skip_special_tokens=True)).strip()

        translate("vi", "khởi động")  # warmup
        print(f"\n=== {name} (device={device}) ===")
        for direction in ["vi", "en"]:
            items = [t for t in testset if t["lang"] == direction]
            hyps, refs, lats = [], [], []
            for t in items:
                t0 = time.perf_counter()
                out = translate(direction, t["text_ref"])
                lats.append(time.perf_counter() - t0)
                hyps.append(out)
                refs.append(t["translation_ref"])
            chrf = sacrebleu.corpus_chrf(hyps, [refs]).score
            bleu = sacrebleu.corpus_bleu(hyps, [refs]).score
            tgt = "en" if direction == "vi" else "vi"
            print(f"  {direction}->{tgt}: chrF {chrf:.1f} | BLEU {bleu:.1f} "
                  f"| latency TB {sum(lats)/len(lats):.2f}s")
        del tr


if __name__ == "__main__":
    main()
