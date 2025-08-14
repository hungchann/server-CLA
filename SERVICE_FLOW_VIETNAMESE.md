# LUỒNG HOẠT ĐỘNG DỊCH VỤ SPEECH-TO-TEXT

## Tổng quan
Dịch vụ chuyển đổi giọng nói thành văn bản sử dụng Google Cloud Speech-to-Text API.

## Luồng chính

### 1. Khởi động hệ thống
- Khởi tạo Express server
- Thiết lập middleware (CORS, JSON parser)
- Tạo thư mục uploads
- Đăng ký routes: `/transcribe`, `/health`

### 2. Xử lý yêu cầu chuyển đổi
```
File âm thanh → Kiểm tra dung lượng → Xếp hàng (nếu cần)
    ↓
Chuyển đổi sang WAV (16kHz, mono)
    ↓
Thử với các mã ngôn ngữ: zh-CN, zh-TW, zh-HK, zh
    ↓
Trả về kết quả + độ tin cậy + số từ
    ↓
Dọn dẹp file tạm
```

### 3. Quản lý phiên
- Giới hạn: 10 yêu cầu đồng thời
- Hàng đợi cho yêu cầu vượt quá
- Dọn dẹp tự động mỗi 5 phút

### 4. Xử lý lỗi
- **TRANSIENT**: Thử lại với backoff (1s, 2s, 4s)
- **PERMANENT**: Trả về lỗi ngay
- **RATE_LIMIT**: Chờ và thử lại
- **SYSTEM**: Ghi log và thử lại

### 5. Các endpoint
- `POST /transcribe`: Chuyển đổi âm thanh
- `GET /health`: Trạng thái hệ thống
- `GET /recovery/status`: Trạng thái phục hồi

## Tính năng chính
- Hỗ trợ nhiều định dạng âm thanh
- Xử lý đa ngôn ngữ tiếng Trung
- Phục hồi tự động từ lỗi
- Quản lý tài nguyên thông minh
- Giám sát hiệu suất real-time
