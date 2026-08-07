# MVP — Video sang Storyboard

Reverse-engineer feature của Kaloclip. Biến 1 video bán hàng → bảng storyboard 3 cột + phân tích "điểm thành công". Xem thiết kế đầy đủ ở `../THIET-KE-Video-sang-Storyboard.md`.

## Kiến trúc (Claude làm engine + ASR cắm-rút)

```
video.mp4
  ├─① media.py   ffmpeg → audio.wav + keyframes (mỗi 3s)
  ├─② asr.py     faster-whisper | whisper.cpp | --transcript → lời thoại + timestamp
  ├─③ llm.py     Claude vision → cỡ cảnh + mô tả hình (gộp nhiều ảnh/lượt gọi)
  └─④ llm.py     Claude → cắt đoạn theo khung marketing + "điểm thành công" (structured output)
        → out/<tên>.json  +  out/<tên>.html (2 tab)  — cache theo hash video
```

Chỉ cần **1 API key** (`ANTHROPIC_API_KEY`). Không cần GPU.

## Cài đặt

```bash
bash setup.sh                      # tạo .venv + cài deps (tránh lỗi PEP 668)
source .venv/bin/activate
export ANTHROPIC_API_KEY=sk-ant-...
```

Cần sẵn `ffmpeg` (máy đã có: `ffmpeg -version`).

## Chạy

```bash
python run.py video.mp4
open out/video.<hash>.html
```

Đổi model rẻ hơn cho vision hàng loạt:
```bash
MODEL=claude-sonnet-5 python run.py video.mp4
```

## ASR — chọn 1 backend

| Backend | Cài | Ghi chú |
|---|---|---|
| **faster-whisper** | `pip install faster-whisper` | Tốt nhất tiếng Việt, chạy CPU. **Kén Python 3.14** — nếu lỗi, dùng cách dưới |
| **whisper.cpp** | `brew install whisper-cpp` + `export WHISPER_CPP_MODEL=/path/ggml-small.bin` | Binary, không phụ thuộc Python |
| **Transcript ngoài** | `python run.py video.mp4 --transcript loi.srt` | Nạp .srt/.json có sẵn — luôn chạy được, bỏ qua ASR |

> Python hệ thống của máy đang là 3.14 (externally-managed). `setup.sh` tạo venv riêng để cài. Nếu faster-whisper vẫn lỗi build trên 3.14, tạo venv bằng Python 3.11/3.12 (`python3.12 -m venv .venv`) hoặc dùng whisper.cpp / `--transcript`.

## Tùy chọn dòng lệnh

```
python run.py VIDEO [--transcript FILE] [--interval 3.0]
              [--asr-model small] [--out out] [--force]
```

- `--interval` giây/keyframe (nhỏ hơn = chi tiết hơn, tốn token hơn)
- `--force` bỏ qua cache, chạy lại
- kết quả cache theo hash nội dung video → mở lại đọc cache, không gọi API lại

## Giao diện web (viewer giống Kaloclip)

```bash
./.venv/bin/pip install fastapi "uvicorn[standard]" python-multipart
./.venv/bin/uvicorn web.app:app --port 8000   # chạy từ thư mục mvp/
# mở http://localhost:8000
```

- 2 tab: **Kịch bản video** (bảng 3 cột) + **Giải thích điểm thành công**, player có caption đồng bộ theo thời gian.
- Dữ liệu lấy từ `GET /api/storyboard` (mặc định đọc `ground-truth/*.kalodata.json`), video từ `GET /api/video`.
- **Đấu nối API video aff sau**: chỉ cần sửa hàm `load_storyboard()` (và 2 hằng `DATA_FILE`/`VIDEO_FILE`) trong `web/app.py` trỏ sang nguồn thật. Field JSON: `kich_ban_video[]` + `giai_thich_diem_thanh_cong{points, ky_thuat_quay_phim}`.

## TikTok Shop — lấy list video affiliate

Trang `/videos` hiển thị video creator gắn sản phẩm shop (open collaboration).

```bash
export TTS_APP_KEY=...      TTS_APP_SECRET=...      TTS_ACCESS_TOKEN=...
./.venv/bin/uvicorn web.app:app --port 8000
# mở http://localhost:8000/videos
```

- Client: `web/tiktok.py` — ký request chuẩn TikTok Shop Open API v2 (HMAC-SHA256), tự lấy `shop_cipher`.
- Endpoint dùng: `GET /affiliate_seller/202412/open_collaborations/creator_content_details`.
- Backend `/api/videos` chuẩn hoá field sang UI + trả kèm `raw_sample` (item gốc) để **chốt mapping** cho khớp response thật.
### Ủy quyền lấy token (OAuth — port từ project AFF Order)

```
Seller bấm ủy quyền  ──►  /auth/tiktok/login  ──►  services.tiktokshops.com/open/authorize
      TikTok redirect về  ──►  /auth/tiktok/callback?code=<auth_code>
      → token/get → lưu web/.tts_token.json (access+refresh) → về /videos
```

- Đặt `TTS_APP_KEY`, `TTS_APP_SECRET`, `TTS_SERVICE_ID`, rồi mở **http://localhost:8000/auth/tiktok/login**.
- Cấu hình **Redirect URL** trong Partner Center trỏ về `.../auth/tiktok/callback`.
- Token tự **refresh** khi gần hết hạn (`token/refresh`). Đã có sẵn token thì set `TTS_ACCESS_TOKEN`/`TTS_REFRESH_TOKEN` để bỏ qua bước ủy quyền.
- Endpoint token: `auth.tiktok-shops.com/api/v2/token/{get,refresh}` (grant_type `authorized_code`/`refresh_token`) — giống hệt bản NestTiktok đã chạy thật.

## Bí quyết nằm ở đâu

3 khung taxonomy trong `storyboard/prompts.py`: cỡ cảnh (đóng), giai đoạn kịch bản affiliate (hook→cta), khung tâm lý bán hàng. Đây là phần "nạp" quyết định chất lượng — chỉnh ở đây trước.

## Nâng cấp gợi ý (v2+)

- Scene-detect (`ffmpeg select='gt(scene,0.3)'`) thay lấy mẫu đều để bám ranh giới cảnh.
- Lưu cache vào DB/S3 theo `video_id` thay vì file.
- Nút "Xuất kịch bản" / "Tối ưu kịch bản" (Claude viết lại hay hơn) như Kaloclip.
