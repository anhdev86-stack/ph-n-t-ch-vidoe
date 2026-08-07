# Web app (Next.js + FastAPI) — port giao diện từ TikTok Order

Giao diện Ant Design (login user, sidebar) copy từ project TikTok Order, backend viết **gọn mới độc lập** (không đụng/không kết nối order project). Kaloclip là 1 tab.

```
web-next/   # frontend Next.js 15 + Ant Design + NextAuth (login user)
backend/    # FastAPI /api/v1: auth JWT + tiktok + storyboard + videos
mvp/        # pipeline phân tích + dữ liệu mẫu (giữ nguyên)
```

## Tab
- **Video sang Storyboard** (Kaloclip) — bảng 2 tab + player, data từ `/api/v1/storyboard`.
- **Video Affiliate** — grid video gắn sản phẩm shop, `/api/v1/videos` (TikTok).
- **Kết nối TikTok** — ủy quyền shop lấy token.

## Chạy

**1) Backend** (cửa sổ 1):
```bash
cd backend
export JWT_SECRET=... ADMIN_USERNAME=admin ADMIN_PASSWORD=... \
       TTS_APP_KEY=... TTS_APP_SECRET=... TTS_SERVICE_ID=...
../mvp/.venv/bin/uvicorn app:app --port 8000 --reload
```

**2) Frontend** (cửa sổ 2):
```bash
cd web-next
npm install      # lần đầu
npm run dev      # http://localhost:3000
```

Đăng nhập bằng `ADMIN_USERNAME`/`ADMIN_PASSWORD` (mặc định `admin`/`admin123` — đổi qua env).

## Kết nối TikTok
Vào tab **Kết nối TikTok** → bấm ủy quyền → TikTok redirect về `http://localhost:8000/api/v1/tiktok/callback` (đặt Redirect URL này trong Partner Center) → token tự lưu `backend/.tts_token.json` (đã gitignore) + auto refresh.

## Auth contract (khớp NextAuth của order)
- `POST /api/v1/auth/login {userName,password}` → `{access_token, refresh_token}` (JWT claims `sub/userName/role/exp`).
- `POST /api/v1/auth/refresh {refresh_token}` → cặp token mới.
- Các API dữ liệu yêu cầu header `Authorization: Bearer <access_token>` (api.ts tự gắn).

## Lưu ý
- ENV frontend ở `web-next/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- Backend độc lập hoàn toàn với project TikTok Order (biến env riêng, token file riêng).
- Còn phải chốt `_norm()` field video sau khi có `raw_sample` thật.
