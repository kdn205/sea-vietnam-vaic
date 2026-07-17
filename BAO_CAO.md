# Báo cáo dự án: Real-time Vietnamese–English Business Meeting Translator

> Hackathon AI 2 ngày — Vietnam AI Innovation Challenge, tài trợ bởi AI Singapore (AISG)
> Tài liệu tổng hợp toàn bộ quá trình nghiên cứu, thí nghiệm và xây dựng prototype (cập nhật 18/07/2026)

---

## 1. Đề bài

Xây dựng prototype **dịch hai chiều Việt ↔ Anh thời gian thực** cho họp trực tiếp giữa đoàn Việt Nam và Singapore. Demo live với ban giám khảo, hội thoại tự do không kịch bản. Output voice hay text đều được, miễn gần real-time. Chạy trên laptop/tablet/điện thoại/thiết bị edge.

### Rubric chấm điểm

| Tiêu chí | Trọng số |
|---|---|
| Độ chính xác dịch (giữ nghĩa, ý định, chi tiết) | 30% |
| Latency / độ phản hồi | 20% |
| UX & nhịp cuộc họp | 20% |
| Chống nhiễu, turn-taking, đổi người nói | 15% |
| Thiết kế kỹ thuật, khả năng triển khai | 15% |

**Điểm thưởng:** open model chạy on-premise (bảo mật), chạy edge device, chịu ồn tốt, xử lý turn-taking, mở rộng sang ngôn ngữ khác (đặc biệt low-resource).

**Giải thưởng:** tiền thưởng + 1-2 tháng visiting researcher tại AI Singapore (NTU).

---

## 2. Ý tưởng & kiến trúc đề xuất

### Kiến trúc tổng thể (cascade, 100% open model chạy local)

```
Mic → VAD (năng lượng) → ASR (Whisper/PhoWhisper) → LID (nhận diện Việt/Anh)
                                                          ↓
                                            MT (envit5, dịch 2 chiều)
                                                          ↓
                                    Phụ đề song ngữ real-time (+ TTS tùy chọn)
```

### Các quyết định kiến trúc chính (đã kiểm chứng bằng benchmark)

1. **Cascade (ASR → MT) thay vì end-to-end**: SeamlessM4T/SeamlessStreaming của Meta làm được một-model-hai-chiều nhưng nặng (2.3B, chật vật với GPU 4GB), research code khó dựng trong 2 ngày, license CC-BY-NC. Cascade cho phép tối ưu và thay thế từng tầng độc lập.
2. **Không cần 2 model cho 2 chiều**: Whisper multilingual nghe được cả Việt lẫn Anh; envit5 dịch được cả 2 chiều trong 1 model (prefix `vi:` / `en:`).
3. **Bỏ ý tưởng dùng Whisper task=translate dịch trực tiếp**: benchmark cho thấy chất lượng kém (chrF 48 vs 73.6 của cascade), và large-v3-turbo mất hẳn khả năng translate (chrF 13 — chỉ chép lại tiếng Việt).
4. **Xử lý turn-taking/nói chồng lấn bằng kiến trúc 2 mic** (mỗi bên bàn 1 mic, 2 pipeline song song, khóa ngôn ngữ theo mic) thay vì diarization bằng AI — đơn giản, tin cậy, khả thi trong 2 ngày. *(Chưa triển khai trong prototype hiện tại — xem mục 8.)*

### Phân tích khó khăn của đề tài

1. **Latency là bài toán vật lý**: chuỗi ASR → dịch cộng dồn độ trễ, chạy local trên GPU yếu buộc đánh đổi model nhỏ (mất accuracy 30%) vs trễ (mất 20%).
2. **Tiếng Việt khó với ASR**: đơn âm tiết, dày thanh điệu, giọng vùng miền; sai 1 từ đổi nghĩa cả câu, lỗi khuếch đại qua tầng dịch.
3. **Code-switching** (chêm tiếng Anh trong câu Việt: "follow up", "deadline", "proposal"): điểm vỡ của mọi ASR đã test, đặc biệt các model fine-tune thuần Việt.
4. **Demo live free-flow**: không kiểm soát được đầu vào, rủi ro "chạy tốt ở nhà chết trên sân khấu" cao; tiếng ồn, vang, mic lạ.
5. **2 ngày cho hệ thống 4+ tầng**: audio streaming ổn định trên Windows đã khó; cần bản end-to-end chạy được sớm nhất có thể.
6. **Cạnh tranh**: Whisper + Google Translate API ghép được trong 3 giờ — khác biệt phải đến từ chống ồn thật, turn-taking thật, chạy offline thật (đúng các mục bonus).

---

## 3. Môi trường & thiết bị

- **Máy:** Windows 11, GPU NVIDIA GTX 1650 4GB VRAM, Python 3.11.9
- **Venv:** `D:\python_project\SEA_VIET_NAM\venv`
- **Thư viện chính:**

| Nhóm | Thư viện | Ghi chú |
|---|---|---|
| ASR | faster-whisper 1.2.1 (CTranslate2 4.8.1) | không cần torch để chạy Whisper |
| Deep learning | torch 2.13.0+cu126, torchvision, torchaudio | bản CUDA, đã xác nhận nhận GTX 1650 |
| LLM/NLP | transformers 4.x (**hạ từ 5.14 xuống** vì tokenizer envit5 không tương thích 5.x), sentencepiece, accelerate, datasets | |
| ML/CV | scikit-learn, scipy, pandas, matplotlib, opencv-python | cài dự phòng |
| Audio | sounddevice (thu mic), av (decode file) | |
| Đo lường | jiwer (WER), sacrebleu (chrF/BLEU) | |
| Tiện ích | edge-tts (tạo audio test tiếng Việt/Anh không cần mic) | |

- **Lưu ý môi trường đã gặp:**
  - Console Windows mặc định cp1252 → phải `sys.stdout.reconfigure(encoding="utf-8")` mới in được tiếng Việt.
  - ctranslate2 cần cuDNN: giải quyết bằng `os.add_dll_directory(<torch>/lib)` để mượn DLL đi kèm torch.
  - Mạng chập chờn: pip/HF download hay đứt giữa chừng → luôn cài với `--timeout 120 --retries 10`, tải model HF có vòng retry; **file tải dở có thể là file 0 byte** (đã dính với audio test) — phải kiểm tra size.
  - transformers 5.x vỡ tokenizer T5 cũ (envit5): `TypeError: argument 'vocab'` → dùng `transformers<5`.

---

## 4. Thí nghiệm 1 — Demo PhoWhisper-base (`phowhisper_demo/`)

Test nhanh `vinai/PhoWhisper-base` **không cần torch/transformers**: dùng faster-whisper + bản convert CTranslate2 có sẵn của cộng đồng (`quocphu/PhoWhisper-ct2-FasterWhisper`, đủ 5 size tiny→large).

**Kết quả:**
- Câu tiếng Việt thuần (TTS 9.1s): phiên âm **chính xác 100%**, xử lý 1.8s, **RTF 0.20** trên CPU int8.
- Câu code-switching "Team mình sẽ follow up cái proposal này và confirm lại deadline...": **vỡ hoàn toàn** → "phim mình sẽ **phò lao úp** cái **pô cô sa** này và **con phim** lại **đích liên**...". Fine-tune thuần Việt làm mất khả năng xử lý từ mượn của Whisper gốc.
- Test `task=translate` (dịch trực tiếp vi→en): ra **"ngày tháng."** — PhoWhisper đã mất hẳn khả năng translate (catastrophic forgetting). Kể cả Whisper gốc cũng chỉ dịch 1 chiều X→Anh → **bắt buộc cần tầng dịch riêng**.

Chạy: `python phowhisper_demo/demo.py --mic 5 --loop` hoặc `--file audio.mp3`

---

## 5. Thí nghiệm 2 — Benchmark có hệ thống (`benchmark/`)

**Bộ test:** 10 câu hội thoại kinh doanh (6 Việt + 4 Anh, có câu code-switching, có giọng Anh-Singapore `en-SG` của edge-tts) kèm đáp án chuẩn. Metrics: latency/câu, RTF, WER (ASR), chrF/BLEU (dịch). Toàn bộ chạy GPU.

### Kết quả (GTX 1650, int8_float16)

| Task | Model | Latency/câu | WER% ↓ | chrF ↑ | BLEU ↑ |
|---|---|---|---|---|---|
| ASR tiếng Việt | PhoWhisper-base | 0.73s | **14.3** | – | – |
| ASR tiếng Việt | whisper-small | 0.90s | 16.3 | – | – |
| ASR tiếng Việt | whisper-large-v3-turbo | 2.71s | **14.3** | – | – |
| ASR tiếng Anh | whisper-small | 0.75s | **0.0** | – | – |
| ASR tiếng Anh | large-v3-turbo | 2.19s | 0.0 | – | – |
| Dịch trực tiếp vi→en (task=translate) | whisper-small | 1.25s | – | 48.0 | 25.9 |
| Dịch trực tiếp vi→en | large-v3-turbo | 3.37s | – | 13.2 ❌ | 1.2 |
| MT vi→en | envit5 (transformers, beam 4) | 2.29s | – | **73.6** | 57.2 |
| MT en→vi | envit5 (transformers, beam 4) | 4.54s | – | **75.5** | 66.7 |

### Kết luận rút ra

1. **Cascade thắng áp đảo** dịch trực tiếp bằng Whisper (chrF 73.6 vs 48.0).
2. **whisper-small** là điểm cân bằng tốc độ/chất lượng tốt nhất cho GPU 4GB; turbo chính xác hơn với code-switching nhưng chậm gấp 3.
3. **envit5 chất lượng dịch rất tốt nhưng quá chậm qua transformers** → cần tối ưu (xem mục 6).
4. WER tiếng Việt bị kéo chủ yếu bởi câu code-switching; câu thuần Việt gần như hoàn hảo ở mọi model.
5. Số liệu trên audio TTS sạch = "trần" chất lượng; mic thật sẽ kém hơn.

### Tối ưu envit5 bằng CTranslate2

Convert: `ct2-transformers-converter --model VietAI/envit5-translation --output_dir models/envit5-ct2 --quantization int8_float16`

| | transformers fp16 beam 4 | transformers fp16 beam 1 | **CT2 int8 beam 1** |
|---|---|---|---|
| Latency/câu | 2.3–4.5s | 0.5–1.9s | **0.13–0.28s** |
| Chất lượng | chuẩn | gần như không giảm | gần như không giảm |

→ Nhanh gấp **4–8 lần**, chất lượng giữ nguyên. Đây là engine dịch chính thức của app.

Chạy benchmark: `python benchmark/make_testset.py` rồi `python benchmark/benchmark.py [--nllb]`. Kết quả lưu `benchmark/results.json`.

---

## 6. Sản phẩm chính — App dịch real-time có giao diện (`live_demo/app.py`)

### Kiến trúc

```
Mic (sounddevice, 16kHz, block 30ms)
  → VAD năng lượng (ngưỡng thích ứng nhiễu nền; im lặng 0.55s = hết câu; câu tối đa 15s)
  → [đang nói] mỗi 0.75s: whisper-small beam 1 → envit5-CT2 → BẢN NHÁP (chữ xám nghiêng, tự cập nhật đè)
  → [dứt câu]  model theo lựa chọn, beam 3    → envit5-CT2 → BẢN CUỐI (thay thế nháp, kèm latency từng khâu)
```

- **Streaming 2 tầng**: nháp = whisper-small (nhanh, giữ nhịp ~1s); bản cuối = model chọn trong dropdown. Hàng đợi nháp latest-wins (không dồn ứ GPU), hàng đợi bản cuối không bao giờ bỏ sót.
- **Tự nhận diện ngôn ngữ** per-utterance, cache theo câu (không lật chiều dịch giữa chừng); giọng Anh-Singapore từng bị nhận nhầm thành **tiếng Malay** → đã thêm fallback chọn lại giữa vi/en theo xác suất rồi phiên âm lại.
- **Routing theo ngôn ngữ**: model PhoWhisper chỉ đảm nhận tiếng Việt, tiếng Anh tự động dùng whisper-small.
- **Chịu mic yếu**: ngưỡng VAD thích ứng (sàn 0.0015), tự khuếch đại audio tối đa 60x trước ASR (mic máy này đo được max amplitude chỉ 0.0013 do Windows để input volume thấp).

### Giao diện (Tkinter)

- Nút **Bắt đầu/Tạm dừng**; chế độ **Tự động / Việt→Anh / Anh→Việt** (khóa cứng chiều dịch khi cần)
- Dropdown **Mic** (đổi thiết bị lúc chạy, stream tự khởi động lại) + thanh **Mic level** theo thang tương đối so với ngưỡng
- Dropdown **Model** — đổi model bản cuối lúc đang chạy, có cache:

| Lựa chọn | ASR vi/câu | Đặc điểm |
|---|---|---|
| whisper-small (nhanh, 2 chiều) | ~1.1s | nhanh nhất, tiếng Việt hay chệch từ |
| PhoWhisper-small (giọng Việt) | ~1.2s | cân bằng |
| PhoWhisper-medium (giọng Việt, mạnh) | ~2.2–2.4s | bắt âm tiếng Việt tốt nhất nhóm nhẹ |
| large-v3-turbo (chính xác, chậm) | ~3s | duy nhất giữ được code-switching, chậm trên GPU 4GB |

- Transcript song ngữ phân màu (xanh dương = Việt, xanh lá = Anh), mỗi câu hiện **latency từng khâu** (`ASR 1.0s + dịch 0.2s = 1.2s`)
- Thanh trạng thái báo lỗi mic/model rõ ràng

### Tiến trình tối ưu latency

| Mốc | Tổng/câu | Ghi chú |
|---|---|---|
| Bản đầu (whisper-small + envit5 transformers beam 1) | 2.27s | |
| + envit5-CT2, beam 3, bỏ VAD filter trùng, im lặng 0.7→0.55s | **1.29s** | dịch chỉ còn 0.19s |
| + streaming nháp khi đang nói | cảm nhận ~1s | chữ hiện ngay khi đang nói |

### Cách chạy

```powershell
D:\python_project\SEA_VIET_NAM\venv\Scripts\python.exe D:\python_project\SEA_VIET_NAM\live_demo\app.py [--asr small|phowhisper|phowhisper-medium|turbo]

# test pipeline không cần mic (dùng 10 câu benchmark):
... app.py --selftest --asr phowhisper-medium
```

---

## 7. Cấu trúc thư mục

```
SEA_VIET_NAM/
├── Real Time Translator Hackathon Challenge (1).docx.pdf   # đề bài
├── BAO_CAO.md                    # tài liệu này
├── venv/                         # môi trường Python (nặng ~7GB do torch CUDA)
├── models/envit5-ct2/            # envit5 đã convert CTranslate2 int8
├── phowhisper_demo/
│   ├── demo.py                   # demo test PhoWhisper-base qua mic/file
│   ├── requirements.txt          # bộ thư viện tối thiểu (không cần torch)
│   └── test_vi.mp3, test_mix.mp3 # audio test
├── benchmark/
│   ├── make_testset.py           # sinh 10 câu audio test bằng edge-tts
│   ├── benchmark.py              # đo latency + WER + chrF/BLEU các model
│   ├── testset.json, audio/      # bộ test + đáp án chuẩn
│   └── results.json              # kết quả benchmark
└── live_demo/
    └── app.py                    # ★ app dịch real-time có giao diện
```

Model cache tại `C:\Users\Admin\.cache\huggingface\hub` (whisper-small, large-v3-turbo, PhoWhisper small/medium, envit5).

---

## 8. Vấn đề đã biết & việc còn lại cho hackathon

### Vấn đề đã biết
1. **Code-switching vẫn là điểm yếu nhất** ở tầng ASR (trừ turbo). Hướng xử lý rẻ: **glossary hậu xử lý** sau ASR (map "phò lao úp"→"follow up", "đích liên/đích linh"→"deadline"...) hoặc để LLM dịch kiêm sửa lỗi phiên âm.
2. **Mic của máy dev tín hiệu rất yếu** (Windows input volume thấp) — app đã bù bằng khuếch đại phần mềm nhưng nên chỉnh Windows Settings → Sound → Input volume 80–100 trên máy demo.
3. PhoWhisper output không viết hoa/dấu câu (style của model).
4. Số benchmark đo trên audio TTS sạch — cần đo lại với giọng thật, phòng ồn.

### Việc còn lại (xếp theo ưu tiên cho 2 ngày hackathon)
- [ ] **Glossary thuật ngữ kinh doanh** hậu xử lý ASR + ép term khi dịch (ăn thẳng 30% điểm accuracy)
- [ ] **Kiến trúc 2 mic / 2 pipeline** cho turn-taking và nói chồng lấn (ăn 15% robustness + bonus)
- [ ] **Chống ồn**: RNNoise/DeepFilterNet trước VAD; demo bật nhạc nền (bonus)
- [ ] **TTS đầu ra** (Piper — nhẹ, có giọng Việt + Anh, chạy edge) phát qua tai nghe
- [ ] **UI 2 màn hình đối diện** (mỗi bên thấy ngôn ngữ của mình) + nút xuất biên bản họp song ngữ
- [ ] Benchmark lại trên **máy demo thật** (GPU khác → số liệu khác hoàn toàn)
- [ ] Luận điểm pitch: 100% open model, offline on-premise (bảo mật), mở rộng ngôn ngữ (Whisper ~100 thứ tiếng, chỉ đổi config)

### Điểm mạnh hiện tại khi đối chiếu rubric
- ✅ Accuracy: cascade + envit5 (chrF 73–75), model selector tùy giọng người nói
- ✅ Latency: ~1.3s/câu + nháp streaming hiện ngay khi đang nói
- ✅ UX: giao diện đơn giản, phụ đề song ngữ, đổi mic/model/chiều dịch không cần restart
- ✅ Deployability: 100% open model, offline, GPU phổ thông 4GB
- ⚠️ Robustness (ồn, overlap): mới có VAD thích ứng + khuếch đại — cần 2 mic + khử ồn
