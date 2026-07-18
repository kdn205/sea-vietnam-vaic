/# Báo cáo dự án: Real-time Vietnamese–English Business Meeting Translator

> Hackathon AI 2 ngày — Vietnam AI Innovation Challenge, tài trợ bởi AI Singapore (AISG)
> Tài liệu tổng hợp toàn bộ quá trình nghiên cứu → thử nghiệm → sản phẩm (cập nhật 18/07/2026)

---

## 1. Đề bài & rubric

Xây prototype **dịch hai chiều Việt ↔ Anh thời gian thực** cho họp trực tiếp, demo live với ban giám khảo (hội thoại tự do). Chấm: accuracy 30%, latency 20%, UX 20%, robustness (ồn/turn-taking) 15%, thiết kế kỹ thuật 15%. **Bonus**: open model on-premise, edge device, chịu ồn, turn-taking, mở rộng ngôn ngữ.

## 2. Sản phẩm hiện tại: Room dịch họp offline (`room_server/`)

**Concept:** mỗi người tham gia mở app trên điện thoại của mình, join một "room" qua mạng LAN cục bộ (laptop phát hotspot — **không cần internet**). Ai nói, câu gốc + bản dịch hiện **lên máy của tất cả mọi người theo thời gian thực, ngay trong khi đang nói**.

```
Điện thoại (trình duyệt) --PCM 16kHz--> Laptop server:
  VAD từng người → ASR theo ngôn ngữ người nói (zipformer vi/en, CPU)
  → dịch (envit5-CT2, GPU) → broadcast text gốc + dịch cho cả room
```

### Tính năng đã hoàn thiện & kiểm chứng
- **Dịch streaming khi đang nói**: chữ đầu hiện sau ~0.9s từ lúc cất tiếng, nháp cập nhật ~0.3–0.5s/nhịp, bản chốt ~1s sau khi dứt lời
- **Nhiều người nói cùng lúc**: worker gom batch (ASR `decode_streams` + MT `translate_batch`) — 3 người đồng thời chi phí ~1.4x một người; test 3 người PASS
- **Lọc "nghe ké"** (2-3 người ngồi cạnh): cổng so tín hiệu tương đối giữa các mic + dedup transcript theo năng lượng (bản mạnh thắng, bản yếu bị xóa khỏi mọi màn hình); test PASS
- **Mỗi người tự chọn "ngôn ngữ đọc"** (chữ to) độc lập với ngôn ngữ nói; bubble phân theo người nói kèm latency từng khâu
- **Hotspot không cần internet**: `start_hotspot.ps1` bật Mobile Hotspot từ nguồn ảo vEthernet (Hyper-V Default Switch) — demo được ở nơi hoàn toàn không có mạng
- **Chịu lỗi thực địa**: tự chọn/đổi mic, level feedback theo ngưỡng VAD thật, tự reconnect khi rớt WebSocket, wake lock giữ màn hình, giới hạn DOM cho họp dài, audio int16 (nửa băng thông)

### Cách chạy demo
```powershell
# 1. Phát hotspot (không cần internet):
powershell -ExecutionPolicy Bypass -File room_server\start_hotspot.ps1
# 2. Tạo cert HTTPS (một lần duy nhất):  python room_server\make_cert.py
# 3. Chạy server:                        python room_server\server.py [--mt float32]
# 4. Điện thoại: TẮT 4G → join Wi-Fi hotspot → mở https://192.168.137.1:8443
#    → Advanced/Proceed (cert tự ký) → nhập tên + ngôn ngữ → 🎙 Nói
```
Test không cần mic: `python room_server\selftest.py` (3 người nói đồng thời) và `python room_server\test_bleed.py` (lọc người ngồi cạnh). Cần mở firewall một lần: `netsh advfirewall firewall add rule name="Room Dich Hop 8443" dir=in action=allow protocol=TCP localport=8443` (admin).

## 3. Model đang dùng & phân bổ CPU/GPU

| Thành phần | Model | Chạy trên | Số đo |
|---|---|---|---|
| ASR tiếng Việt | zipformer-vi int8 (sherpa-onnx, train **70k giờ**), 74MB | **CPU** 4 luồng | **WER 7.1%**, RTF 0.04 |
| ASR tiếng Anh | zipformer-gigaspeech int8, 70MB | **CPU** | WER 4.5%, 0.38s/câu |
| Dịch 2 chiều | envit5-translation (VietAI, 275M) CT2 **int8_float16**, 264MB | **GPU** (fallback CPU) | chrF 73.6/75.6, ~0.3s (nháp beam 1) / ~0.5s (chốt beam 4) |
| VAD + lọc người nói | năng lượng thích ứng (tự viết) | CPU | ~0 |

Lý do phân bổ: zipformer int8 quá nhanh trên CPU nên GPU dành trọn cho dịch — hai tầng không giành tài nguyên khi nhiều người nói.

## 4. Nhật ký benchmark (bằng chứng cho mọi lựa chọn)

Bộ test: 10 câu hội thoại kinh doanh TTS (6 vi + 4 en, có code-switching, có giọng en-SG) + đáp án chuẩn. Metrics: WER (jiwer), chrF/BLEU (sacrebleu), latency. Chạy trên GTX 1650 4GB / CPU 4 luồng.

### ASR (đã chọn: zipformer)
| Model | WER vi | Latency | Ghi chú |
|---|---|---|---|
| **zipformer-vi int8** ✅ | **7.1%** | 0.20s CPU | thắng tuyệt đối, chạy được mobile |
| PhoWhisper-base | 14.3% | 1.02s CPU | mất khả năng translate; vỡ code-switching nặng |
| whisper-small | 16.3% | 0.90s GPU | en WER 0% |
| whisper-large-v3-turbo | 14.3% | 2.71s GPU | duy nhất giữ được code-switching; task=translate hỏng (chrF 13) |

### Dịch (đã chọn: envit5 int8 + beam 4 bản chốt)
| Phương án | chrF vi→en / en→vi | Kết luận |
|---|---|---|
| **envit5-CT2 int8_float16** ✅ | 74.3 / 75.6 | điểm tối ưu cả 3 trục |
| envit5-CT2 float32 (1GB) | 70.9 / 75.5 | chất lượng y hệt (chênh = nhiễu đo), nặng gấp 4 → loại |
| NLLB-600M | **59.1** / 76.4 | thua đậm vi→en → loại; model chuyên cặp thắng model 200 ngôn ngữ |
| Whisper task=translate | chrF 48 | cascade thắng dịch trực tiếp → loại |
| envit5 qua transformers | (chất lượng ngang) | chậm 4–8 lần bản CT2 → chỉ dùng CT2 |

### Bài học kỹ thuật đáng nhớ
- Quantize int8 với model dịch cỡ này **không mất chất lượng** — đã kiểm chứng cả benchmark lẫn test tai người
- Lỗi "dịch sai" phần lớn là **lỗi ASR truyền xuống** (nghe sai → dịch đúng cái sai); code-switching là điểm vỡ của mọi ASR đã test
- Echo cancellation của trình duyệt **chủ động xóa** âm phát từ loa cùng máy — bẫy khi test bằng cách mở audio qua loa
- Android âm thầm chuyển trình duyệt sang 4G khi Wi-Fi "không có internet" → **checklist demo: tắt 4G**
- Windows có thể trỏ mic mặc định vào endpoint chết → app phải tự quét/cho chọn mic
- transformers 5.x vỡ tokenizer envit5 → ghim `transformers<5`

## 5. Lộ trình cải thiện chất lượng dịch (đã phân tích, chưa lắp)

Xếp theo hiệu quả/chi phí, **không cần model nặng hơn lúc chạy**:
1. **Khôi phục dấu câu + viết hoa trước khi dịch** (~40ms CPU): zipformer trả text trơn làm envit5 dịch phẳng, câu hỏi thành trần thuật. Model: `punct_cap_seg_47_language` (47 ngôn ngữ có vi, có ONNX) hoặc xlm-roberta-capu
2. **Term protection**: khóa thuật ngữ/tên riêng trước MT, trả nguyên vẹn sau (glossary theo room)
3. **Hotwords zipformer**: bias ASR về thuật ngữ cuộc họp — 0 latency
4. **LoRA fine-tune envit5 văn phong business**: train offline một lần, inference không đổi — "văn phong không cần size"
5. **LLM sửa câu theo nghĩa** (Qwen 3B q4 qua Ollama, chỉ bản chốt, +1–1.5s): cứu lỗi nghe nhầm/code-switching — tính năng của bản laptop hub; mobile tầm trung không kham nổi

## 6. Đường lên mobile app (phase 2)

**Kiến trúc khuyến nghị: phân tán** — 1 điện thoại Android phát hotspot + relay text (gần 0 tải); **mỗi máy tự ASR + dịch giọng của chính chủ** rồi broadcast text. Tải không tăng theo số người (mỗi người mang theo compute của mình), hết bài toán nghe ké, không cần cert HTTPS (mic là quyền app). Bê nguyên mô hình hub lên 1 điện thoại thì chỉ demo ngắn được — quá nhiệt + tụt pin khi họp dài.

Chuẩn bị đã xong: envit5 export **ONNX int8** (893MB, 0.8–0.9s/câu CPU laptop ≈ 1.5–2s trên flagship — script `models/quantize_envit5.py`); zipformer chạy native qua sherpa-onnx (có package Flutter `sherpa_onnx`); pipeline + giao thức room đã kiểm chứng trên laptop. Số đo CPU-only (mô phỏng điện thoại): ASR vi 1.0s, en 0.9s, MT 0.27s (CT2) / 0.9s (ONNX Runtime).

## 7. Cấu trúc thư mục & vị trí file

```
sea-vietnam-vaic/
├── BAO_CAO.md, requirements.txt, .gitignore
├── room_server/     ★ server.py, index.html, selftest.py, test_bleed.py,
│                      make_cert.py, start_hotspot.ps1
├── live_demo/       app.py (bản desktop Tkinter, cờ --mobile), mictest.py
├── benchmark/       make_testset.py, benchmark.py, bench_cpu.py,
│                    bench_zipformer(_en).py, bench_mt_precision.py,
│                    testset.json, audio/, results.json
├── models/          quantize_envit5.py (model binaries không commit —
│                    tự tải/convert theo lệnh trong mục 2 & 6)
└── pho.py           script test PhoWhisper thời kỳ đầu
```

Model tải về nằm ở HF cache (`~/.cache/huggingface`) và `models/` (envit5-ct2 convert bằng: `ct2-transformers-converter --model VietAI/envit5-translation --output_dir models/envit5-ct2 --quantization int8_float16`).

## 8. Đối chiếu rubric

- **Accuracy 30%**: zipformer-vi WER 7.1% (tốt nhất trong 6 model test) + envit5 chrF 74–76 + beam 4; lộ trình mục 5 còn dư địa
- **Latency 20%**: chữ đầu 0.9s khi đang nói, bản chốt ~1s sau dứt lời — ngang Google Translate conversation mode, nhưng offline
- **UX 20%**: room nhiều người, mỗi người đọc ngôn ngữ mình chọn, không cần cài app (trình duyệt), tự reconnect
- **Robustness 15%**: mic ai người nấy thu (close-mic) giải turn-taking tận gốc + lọc nghe ké 2 lớp + noise suppression
- **Kỹ thuật 15%**: 100% open model, on-premise, không internet, có benchmark đối chứng cho mọi lựa chọn, test tự động
- **Bonus**: on-premise ✅, edge-ready (đường mobile đã chứng minh) ✅, chịu ồn ✅, turn-taking ✅, mở rộng ngôn ngữ (sherpa-onnx + NLLB họ 200 thứ tiếng, đổi model là xong) ✅
