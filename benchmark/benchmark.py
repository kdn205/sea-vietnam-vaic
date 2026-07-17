# -*- coding: utf-8 -*-
"""
Benchmark ASR + dich cho hackathon translator (do latency va accuracy).

Do luong:
  - ASR:  latency trung binh / cau, RTF, WER (%) so voi dap an
  - Whisper task=translate (vi audio -> en text truc tiep): latency + chrF
  - MT (envit5 2 chieu): latency / cau, chrF va BLEU so voi ban dich chuan
  - Cascade (ASR tot nhat + MT): tong latency + chrF

Chay: python benchmark.py            # bo mac dinh
      python benchmark.py --nllb     # them NLLB-600M
"""
import argparse
import gc
import json
import os
import re
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
TESTSET = os.path.join(HERE, "testset.json")

import torch  # noqa: E402  (import truoc de nap san DLL CUDA/cuDNN cho ctranslate2)

# cho ctranslate2 tim thay cuDNN di kem torch
_torch_lib = os.path.join(os.path.dirname(torch.__file__), "lib")
if os.path.isdir(_torch_lib):
    os.add_dll_directory(_torch_lib)

ASR_MODELS = [
    # (ten, nguon, subfolder-neu-co)
    ("PhoWhisper-base", "quocphu/PhoWhisper-ct2-FasterWhisper", "PhoWhisper-base-ct2-fasterWhisper"),
    ("whisper-small", "Systran/faster-whisper-small", None),
    ("whisper-large-v3-turbo", "deepdml/faster-whisper-large-v3-turbo-ct2", None),
]


def norm_text(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def resolve_model_path(repo, subfolder):
    if subfolder is None:
        return repo
    from huggingface_hub import snapshot_download
    root = snapshot_download(repo, allow_patterns=[f"{subfolder}/*"])
    return os.path.join(root, subfolder)


def load_whisper(path):
    """Thu GPU truoc, hong thi ve CPU int8. Tra ve (model, device_str)."""
    from faster_whisper import WhisperModel
    if torch.cuda.is_available():
        try:
            m = WhisperModel(path, device="cuda", compute_type="int8_float16")
            # warmup de chac chan GPU chay duoc (loi ct2 thuong no luc infer)
            segs, _ = m.transcribe(os.path.join(HERE, "audio", "vi1.mp3"),
                                   language="vi", beam_size=1)
            list(segs)
            return m, "cuda"
        except Exception as e:
            print(f"  (GPU khong chay duoc: {type(e).__name__}: {e} -> dung CPU)")
            del m
            gc.collect()
    m = WhisperModel(path, device="cpu", compute_type="int8")
    return m, "cpu"


def bench_asr(testset, results):
    import jiwer
    import sacrebleu

    for name, repo, sub in ASR_MODELS:
        print(f"\n=== ASR: {name} ===")
        path = resolve_model_path(repo, sub)
        model, device = load_whisper(path)
        is_multilingual = "PhoWhisper" not in name

        for lang in ["vi", "en"]:
            if not is_multilingual and lang == "en":
                continue  # PhoWhisper chi nghe tieng Viet
            items = [t for t in testset if t["lang"] == lang]
            hyps, refs, lats, durs = [], [], [], []
            for t in items:
                t0 = time.perf_counter()
                segs, info = model.transcribe(t["audio"], language=lang, beam_size=5)
                text = " ".join(s.text.strip() for s in segs)
                lats.append(time.perf_counter() - t0)
                durs.append(info.duration)
                hyps.append(text)
                refs.append(t["text_ref"])
                print(f"  [{t['id']}] {lats[-1]:.2f}s | {text}")
            wer = jiwer.wer([norm_text(r) for r in refs],
                            [norm_text(h) for h in hyps]) * 100
            results.append({
                "task": f"ASR {lang}", "model": name, "device": device,
                "latency_s": sum(lats) / len(lats),
                "rtf": sum(lats) / sum(durs),
                "wer_pct": wer, "chrf": None, "bleu": None,
            })
            print(f"  -> WER {wer:.1f}% | latency TB {sum(lats)/len(lats):.2f}s | RTF {sum(lats)/sum(durs):.2f}")

        # Whisper goc: thu dich truc tiep vi audio -> en text (task=translate)
        if is_multilingual:
            items = [t for t in testset if t["lang"] == "vi"]
            hyps, refs, lats = [], [], []
            for t in items:
                t0 = time.perf_counter()
                segs, _ = model.transcribe(t["audio"], language="vi",
                                           task="translate", beam_size=5)
                text = " ".join(s.text.strip() for s in segs)
                lats.append(time.perf_counter() - t0)
                hyps.append(text)
                refs.append(t["translation_ref"])
                print(f"  [translate {t['id']}] {lats[-1]:.2f}s | {text}")
            chrf = sacrebleu.corpus_chrf(hyps, [refs]).score
            bleu = sacrebleu.corpus_bleu(hyps, [refs]).score
            results.append({
                "task": "vi audio->en text (direct)", "model": name, "device": device,
                "latency_s": sum(lats) / len(lats), "rtf": None,
                "wer_pct": None, "chrf": chrf, "bleu": bleu,
            })
            print(f"  -> translate: chrF {chrf:.1f} | BLEU {bleu:.1f} | latency TB {sum(lats)/len(lats):.2f}s")

        del model
        gc.collect()
        torch.cuda.empty_cache() if torch.cuda.is_available() else None


def bench_mt(testset, results, use_nllb=False):
    import sacrebleu
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32

    def run_mt(name, model_id, translate_fn_builder):
        print(f"\n=== MT: {name} (device={device}) ===")
        tok = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_id, dtype=dtype).to(device)
        model.eval()
        translate = translate_fn_builder(tok, model)
        translate("vi", "en", "khởi động")  # warmup

        for src, tgt in [("vi", "en"), ("en", "vi")]:
            items = [t for t in testset if t["lang"] == src]
            hyps, refs, lats = [], [], []
            for t in items:
                t0 = time.perf_counter()
                out = translate(src, tgt, t["text_ref"])
                lats.append(time.perf_counter() - t0)
                hyps.append(out)
                refs.append(t["translation_ref"])
                print(f"  [{t['id']}] {lats[-1]:.2f}s | {out}")
            chrf = sacrebleu.corpus_chrf(hyps, [refs]).score
            bleu = sacrebleu.corpus_bleu(hyps, [refs]).score
            results.append({
                "task": f"MT {src}->{tgt}", "model": name, "device": device,
                "latency_s": sum(lats) / len(lats), "rtf": None,
                "wer_pct": None, "chrf": chrf, "bleu": bleu,
            })
            print(f"  -> {src}->{tgt}: chrF {chrf:.1f} | BLEU {bleu:.1f} | latency TB {sum(lats)/len(lats):.2f}s")

        del model, tok
        gc.collect()
        torch.cuda.empty_cache() if device == "cuda" else None

    # --- envit5: mot model dich ca 2 chieu, prefix "vi: "/"en: " ---
    def envit5_builder(tok, model):
        def translate(src, tgt, text):
            inp = f"{src}: {text}"
            ids = tok(inp, return_tensors="pt").input_ids.to(device)
            with torch.no_grad():
                out = model.generate(ids, max_length=256, num_beams=4)
            text_out = tok.decode(out[0], skip_special_tokens=True)
            return re.sub(r"^(vi|en):\s*", "", text_out).strip()
        return translate

    run_mt("envit5-translation", "VietAI/envit5-translation", envit5_builder)

    # --- NLLB-600M (tuy chon) ---
    if use_nllb:
        def nllb_builder(tok, model):
            codes = {"vi": "vie_Latn", "en": "eng_Latn"}
            def translate(src, tgt, text):
                tok.src_lang = codes[src]
                ids = tok(text, return_tensors="pt").to(device)
                with torch.no_grad():
                    out = model.generate(
                        **ids, max_length=256, num_beams=4,
                        forced_bos_token_id=tok.convert_tokens_to_ids(codes[tgt]))
                return tok.decode(out[0], skip_special_tokens=True).strip()
            return translate

        run_mt("nllb-200-distilled-600M", "facebook/nllb-200-distilled-600M", nllb_builder)


def print_summary(results):
    print("\n" + "=" * 100)
    print("BANG TONG KET (latency = giay/cau, WER thap = tot, chrF/BLEU cao = tot)")
    print("=" * 100)
    header = f"{'Task':<28} {'Model':<26} {'Dev':<5} {'Latency':>8} {'RTF':>6} {'WER%':>7} {'chrF':>7} {'BLEU':>7}"
    print(header)
    print("-" * len(header))
    for r in results:
        def fmt(v, spec=".2f"):
            return format(v, spec) if v is not None else "-"
        print(f"{r['task']:<28} {r['model']:<26} {r['device']:<5} "
              f"{fmt(r['latency_s']):>8} {fmt(r['rtf']):>6} "
              f"{fmt(r['wer_pct'], '.1f'):>7} {fmt(r['chrf'], '.1f'):>7} {fmt(r['bleu'], '.1f'):>7}")
    out = os.path.join(HERE, "results.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nDa luu chi tiet vao {out}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nllb", action="store_true", help="them benchmark NLLB-600M")
    parser.add_argument("--skip-asr", action="store_true")
    parser.add_argument("--skip-mt", action="store_true")
    args = parser.parse_args()

    with open(TESTSET, encoding="utf-8") as f:
        testset = json.load(f)
    print(f"Bo test: {len(testset)} cau | GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'khong'}")

    results = []
    try:
        if not args.skip_asr:
            bench_asr(testset, results)
        if not args.skip_mt:
            bench_mt(testset, results, use_nllb=args.nllb)
    finally:
        print_summary(results)


if __name__ == "__main__":
    main()
