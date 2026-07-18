# -*- coding: utf-8 -*-
"""Quantize envit5 ONNX sang int8 cho mobile (dynamic quantization)."""
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from onnxruntime.quantization import QuantType, quantize_dynamic

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "envit5-onnx")
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "envit5-onnx-int8")

os.makedirs(DST, exist_ok=True)

for f in ["encoder_model.onnx", "decoder_model_merged.onnx"]:
    print(f"Quantize {f} ...")
    quantize_dynamic(os.path.join(SRC, f), os.path.join(DST, f),
                     weight_type=QuantType.QInt8)

for f in ["config.json", "generation_config.json", "special_tokens_map.json",
          "spiece.model", "tokenizer.json", "tokenizer_config.json"]:
    shutil.copy(os.path.join(SRC, f), DST)

total = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST)) / 1e6
print(f"Xong -> {DST} ({total:.0f} MB)")
