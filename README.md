# appdichmobile — Trình Dịch Hội Thoại VI-EN Thời Gian Thực

Ứng dụng di động cho phiên dịch và chép lời song ngữ Anh-Việt thời gian thực, dành cho các cuộc họp trực tiếp. Nhận dạng giọng nói và dịch thuật đều chạy trên thiết bị, không cần internet cho chức năng chính.

Xem [PROJECT.md](./PROJECT.md) để biết thêm chi tiết về kiến trúc và kỹ thuật.

## Tải Xuống

- **APK (Android):** [Tải xuống phiên bản mới nhất](https://expo.dev/artifacts/eas/7Ze1h-rm8cqCMlizEtUtkLkcSJR6Jo_6KLRhLV98p6I.apk)

## Hướng Dẫn Sử Dụng

### Bắt Đầu

1. **Mở ứng dụng**, bạn sẽ thấy màn hình nhập tên và 3 lựa chọn chế độ.

2. **Nhập tên hiển thị** (không bắt buộc) — tên này sẽ xuất hiện trên caption của bạn.

### Chế Độ Sử Dụng

| Chế độ | Khi nào dùng | Cách dùng |
|--------|--------------|-----------|
| **Một mình (Solo)** | Một người dùng một máy | Bấm "Dùng một mình" → bấm **Start listening** → nói → xem caption + bản dịch |
| **Tạo phòng (Host)** | Bạn mở phiên họp, người khác tham gia qua WiFi | Bấm "Tạo phòng (Host)" → QR code hiện ra → người khác quét mã để vào → bấm "Bắt đầu" |
| **Tham gia (Join)** | Bạn tham gia vào phòng của người khác | Bấm "Tham gia (Join)" → quét mã QR của Host → bấm "Xin phát biểu" → chờ Host duyệt → nói |

### Luồng Hội Thoại

- **Start listening** — Bấm nút để bắt đầu nghe. Giọng nói được nhận dạng và dịch tự động.
- **Stop** — Bấm để dừng nghe.
- **Caption** — Mỗi câu nói hoàn chỉnh hiển thị: người nói → ngôn ngữ gốc → bản dịch.
- **Bản nháp** — Trong khi bạn nói, bản dịch nháp xuất hiện ngay dưới dạng in nghiêng, cập nhật theo thời gian thực.

### Tinh Chỉnh

- **Thanh trượt độ nhạy mic** — Kéo lên để bắt được giọng nhỏ (phòng yên tĩnh), kéo xuống để lọc tạp âm (phòng ồn). Nếu câu nói bị bỏ sót, hãy kéo lên và nói to hơn.

### Gemini API (Tùy Chọn)

Hai tính năng cần kết nối Gemini:

- **Giải thích** — Chọn một đoạn text trong caption → bấm "Giải thích" để xem giải nghĩa tiếng Việt.
- **Tóm tắt phiên** — Khi kết thúc phiên, transcript được tóm tắt tự động.

**Cách bật:**
1. Bấm nút **API key** trên thanh công cụ.
2. Bật công tắc đồng ý chia sẻ dữ liệu với Gemini.
3. Nhập địa chỉ server proxy (quét QR từ terminal khi chạy `npm run server`, hoặc nhập tay).
4. Bấm **Lưu**.

> **Lưu ý:** Hai tính năng này là tùy chọn. Chức năng nghe và dịch chính vẫn chạy hoàn toàn ngoại tuyến, không cần Gemini.

### Lịch Sử

- Bấm **Lịch sử** để xem lại các phiên trước đó.
- Vuốt để xoá phiên cũ.

## Thông Tin Nhóm

**Tên nhóm:** SEA VIET NAM

| Thành viên | Email |
|------------|-------|
| Nguyễn Trọng Minh | tminh193.bil@gmail.com |
| Nguyễn Văn Hoàng | hoangnguyen.bin02@gmail.com |
| Đàm Xuân Giáp | damgiap9999@gmail.com |
| Hoàng Phúc Quân | hoangphucquan2004@gmail.com |
| Cao Thị Thu Trang | caothutrang11072004@gmail.com |
| Nguyễn Duy Khánh | khanhnguyen22011@gmail.com |

## Phát Triển (Developer)

### Cài Đặt & Chạy

```bash
# Cài đặt dependencies
npm install

# Chạy ứng dụng
npm start           # Expo dev server
npm run android     # Android
npm run ios         # iOS
npm run web         # Web

# Chạy Gemini proxy server (tùy chọn)
npm run server
# hoặc chạy cả hai cùng lúc:
npm run dev:all
```

### Công Nghệ

- **Framework:** React Native / Expo 57
- **Nhận dạng giọng nói:** expo-speech-recognition (thiết bị gốc)
- **Dịch thuật:** expo-translate-text (ML Kit, trên thiết bị)
- **Mạng ngang hàng:** react-native-tcp-socket (LAN)
- **Lưu trữ:** AsyncStorage
- **AI (tùy chọn):** Google Gemini 2.0 Flash

---

Dự án tham gia **Vietnam AI Challenge 2026** — hạng mục Trình dịch hội thoại thời gian thực do **AI Singapore** tài trợ.
