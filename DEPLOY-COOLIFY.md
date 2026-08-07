# Deploy lên Coolify (VPS 164) — video.infitech.vn

Máy Mac **không cần build Docker** — Coolify build ngay trên VPS. Kiến trúc:

```
Internet → video.infitech.vn (Coolify/Traefik, SSL tự động)
                │
                ▼
        web  (Next.js :3000)  ── proxy /api/* ──►  api (FastAPI :8000, chỉ nội bộ)
                                                     ├─ Claude (Opus 5)
                                                     ├─ faster-whisper (ASR, CPU)
                                                     └─ ffmpeg + yt-dlp
```

Chỉ **web** ra ngoài. Mọi request `/api/*` được Next proxy nội bộ sang `api:8000` → **1 domain duy nhất, không CORS, backend không lộ ra Internet**.

---

## 1. DNS (làm trước, chờ vài phút lan truyền)

Tại nơi quản lý tên miền `infitech.vn`, thêm bản ghi:

| Type | Name  | Value            |
|------|-------|------------------|
| A    | video | `<IP của VPS 164>` |

Kiểm tra: `dig +short video.infitech.vn` phải ra đúng IP VPS.

---

## 2. Tạo resource trên Coolify

1. Coolify → Project → **+ New** → **Docker Compose (from Git)**.
2. Nguồn Git: repo `anhdev86-stack/ph-n-t-ch-vidoe`, branch **main**.
   - Repo public: dán URL là được. Private: kết nối qua GitHub App hoặc thêm Deploy Key Coolify cung cấp vào repo.
3. **Compose file path**: `docker-compose.yml` (ở gốc repo).
4. Base directory: `/` (gốc).

## 3. Environment Variables

Vào tab **Environment Variables** của resource, thêm (xem `.env.production.example`):

```
NEXTAUTH_URL=https://video.infitech.vn
WEB_ORIGIN=https://video.infitech.vn
NEXTAUTH_SECRET=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<mật khẩu mạnh>
ANTHROPIC_API_KEY=sk-ant-...
MODEL=claude-opus-5
```

Sinh secret (chạy trên máy anh hoặc VPS):
```bash
openssl rand -hex 32
```

> `NEXTAUTH_URL` cũng được dùng làm **build-arg** cho web (đã khai trong compose) nên cần có sẵn trước khi build.

## 4. Gán domain cho service `web`

Trong Coolify, ở service **web**:
- **Domain**: `https://video.infitech.vn`
- **Port**: `3000`
- Bật **HTTPS / Let's Encrypt** (Coolify tự cấp SSL).

Service **api** để nguyên (không gán domain) — chỉ chạy nội bộ.

## 5. Deploy

Bấm **Deploy**. Lần đầu lâu (~5–10 phút) vì cài `faster-whisper`, `ffmpeg`, build Next.
Theo dõi log tới khi cả 2 service **healthy**.

---

## 6. Cập nhật TikTok Partner (bắt buộc để uỷ quyền shop chạy được)

Trong TikTok Shop Partner Center → app của anh:
- **Redirect URL / Callback**: `https://video.infitech.vn/callback`

Sau khi deploy, vào tab **Kết nối TikTok** trên web, nhập lại App Key/Secret/Service ID và uỷ quyền từng shop (token lưu trong volume `api_cache`, không mất khi redeploy).

---

## 7. Kiểm tra

- `https://video.infitech.vn` → trang login. Đăng nhập `admin` / `ADMIN_PASSWORD`.
- `https://video.infitech.vn/api/v1/health` → `{"ok":true}` (qua proxy).
- Tab Video Affiliate → chọn shop → Phân tích.
- Bấm ID video → tab Storyboard phân tích (lần đầu tải model whisper ~150MB, hơi lâu; sau đó nhanh vì đã cache trong volume).

---

## Dữ liệu bền (Docker volumes — không mất khi redeploy)

| Volume        | Chứa gì                                                    |
|---------------|------------------------------------------------------------|
| `api_cache`   | storyboard đã phân tích + lịch sử + token TikTok + model whisper |
| `api_videos`  | video TikTok tải về                                        |
| `api_uploads` | video đối thủ upload lên                                   |

## Update code sau này

Push lên nhánh `main` → Coolify tự deploy lại (nếu bật Auto Deploy / webhook), hoặc bấm **Redeploy** thủ công. Cache phân tích & token giữ nguyên.

## Ghi chú tài nguyên VPS

ASR (faster-whisper) chạy **CPU** → nên có **≥ 2 vCPU, ≥ 4 GB RAM**. Phân tích 1 video mất ~1–3 phút. Muốn rẻ/nhanh hơn cho phần Claude: đặt `MODEL=claude-sonnet-5`.
```
