#!/usr/bin/env python3
"""
Download all required models to local HuggingFace cache.
This ensures offline-ready operation after first download.
"""
import os
import sys
import time
from pathlib import Path

CACHE_DIR = os.path.expanduser("~/.cache/huggingface/hub")

def download_nllb():
    """Download facebook/nllb-200-distilled-600M translation model."""
    print("=" * 60)
    print("Downloading NLLB translation model...")
    print("facebook/nllb-200-distilled-600M (~1.2 GB)")
    print("=" * 60)
    t0 = time.time()

    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    model_name = "facebook/nllb-200-distilled-600M"

    print("Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    print("Downloading model...")
    model = AutoModelForSeq2SeqLM.from_pretrained(
        model_name,
        trust_remote_code=True,
        torch_dtype="auto",
        low_cpu_mem_usage=True,
    )
    elapsed = time.time() - t0
    print(f"\nNLLB model downloaded in {elapsed:.1f}s")
    print(f"  Parameters: {model.num_parameters():,}")
    print(f"  Vocab size: {tokenizer.vocab_size:,}")
    print(f"  Model type: {model.__class__.__name__}")
    print()


def download_whisper():
    """Download faster-whisper small model for English+Vietnamese ASR."""
    print("=" * 60)
    print("Downloading Whisper STT model (small)...")
    print("guillaumeklay/faster-whisper-small (~460 MB)")
    print("=" * 60)
    t0 = time.time()

    from faster_whisper import WhisperModel

    # Downloads and caches automatically
    model = WhisperModel("small", device="cpu", compute_type="int8")
    elapsed = time.time() - t0

    print(f"\nWhisper model loaded in {elapsed:.1f}s")
    print(f"  Model size: small (~460 MB)")
    print(f"  Supports: multilingual (English, Vietnamese, ...)")
    print()


def check_cache():
    """Show huggingface cache size."""
    cache_path = Path(CACHE_DIR)
    if cache_path.exists():
        total_size = sum(
            f.stat().st_size for f in cache_path.rglob("*") if f.is_file()
        )
        print(f"HuggingFace cache: {total_size / 1024**3:.2f} GB")
    else:
        print("HuggingFace cache: empty (not yet created)")


def list_languages():
    """Show NLLB languages relevant to this demo."""
    print("=" * 60)
    print("NLLB language codes for English <-> Vietnamese")
    print("=" * 60)
    print("  eng_Latn  → English (Latin script)")
    print("  vie_Latn  → Vietnamese (Latin script)")
    print()
    print("NLLB supports 200 languages — these two cover our demo.")
    print()


if __name__ == "__main__":
    print(f"Python: {sys.version}")
    print(f"Cache dir: {CACHE_DIR}")
    print()

    check_cache()
    download_whisper()
    download_nllb()
    list_languages()
    check_cache()

    print("=" * 60)
    print("All models downloaded and cached locally!")
    print("Run the app with:  python app.py")
    print("=" * 60)
