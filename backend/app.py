"""Backend gọn cho web-next (Next.js). Prefix /api/v1 — khớp contract NextAuth.

Endpoints:
  POST /api/v1/auth/login     {userName, password} -> {access_token, refresh_token}
  POST /api/v1/auth/refresh   {refresh_token}      -> {access_token, refresh_token}
  GET  /api/v1/me                                  (Bearer) -> user
  GET  /api/v1/storyboard                          (Bearer) -> dữ liệu 2 phần
  GET  /api/v1/videos                              (Bearer) -> list video affiliate
  GET  /api/v1/tiktok/authorize-url                (Bearer) -> {url}
  GET  /api/v1/tiktok/callback?code=...            -> đổi auth_code, lưu token

Chạy:
  cd backend
  ../mvp/.venv/bin/uvicorn app:app --port 8000 --reload
"""
import json
import os
import shutil
import sys
import time
import uuid
from datetime import date, timedelta

import jwt
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(__file__))
import tiktok  # noqa: E402
import users  # noqa: E402

HERE = os.path.dirname(__file__)
ROOT = os.path.dirname(HERE)

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-đổi-trong-production")
ADMIN_USER = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "admin123")
ACCESS_TTL = 60 * 60          # 1h
REFRESH_TTL = 60 * 60 * 24 * 7  # 7d
STORYBOARD_JSON = os.environ.get(
    "STORYBOARD_JSON",
    os.path.join(ROOT, "mvp", "ground-truth", "7653105429953645844.kalodata.json"),
)
WEB_ORIGIN = os.environ.get("WEB_ORIGIN", "http://localhost:3000")

app = FastAPI(title="Kaloclip backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEB_ORIGIN, "http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


@app.get("/api/v1/health")
def health():
    return {"ok": True}


# ---------- JWT ----------
def _make_token(sub: str, role: str, ttl: int, kind: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {"sub": sub, "userName": sub, "role": role, "kind": kind,
         "iat": now, "exp": now + ttl},
        JWT_SECRET, algorithm="HS256",
    )


def _issue(sub: str, role: str = "admin") -> dict:
    return {
        "access_token": _make_token(sub, role, ACCESS_TTL, "access"),
        "refresh_token": _make_token(sub, role, REFRESH_TTL, "refresh"),
    }


def require_user(authorization: str = Header(default="")) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Thiếu token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Token không hợp lệ: {e}")
    if payload.get("kind") != "access":
        raise HTTPException(401, "Sai loại token")
    return payload


def require_admin(user: dict = Depends(require_user)) -> dict:
    """Chỉ admin: uỷ quyền TikTok + quản lý tài khoản."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Chỉ admin mới có quyền dùng chức năng này")
    return user


# ---------- Auth ----------
class LoginBody(BaseModel):
    userName: str
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


@app.post("/api/v1/auth/login")
def login(body: LoginBody):
    u = users.authenticate(body.userName, body.password)
    if not u:
        raise HTTPException(401, "Sai tài khoản hoặc mật khẩu")
    return _issue(u["username"], u["role"])


@app.post("/api/v1/auth/refresh")
def refresh(body: RefreshBody):
    try:
        payload = jwt.decode(body.refresh_token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "refresh_token không hợp lệ")
    if payload.get("kind") != "refresh":
        raise HTTPException(401, "Sai loại token")
    return _issue(payload["sub"], payload.get("role", "admin"))


@app.get("/api/v1/me")
def me(user: dict = Depends(require_user)):
    return {"userName": user["sub"], "role": user.get("role")}


# ---------- Storyboard (Kaloclip) ----------
STORYBOARD_VIDEO = os.environ.get(
    "STORYBOARD_VIDEO",
    os.path.join(ROOT, "mvp", "samples", "7653105429953645844.mp4"),
)


@app.get("/api/v1/storyboard")
def storyboard(user: dict = Depends(require_user)):
    with open(STORYBOARD_JSON, encoding="utf-8") as f:
        return JSONResponse(json.load(f))


@app.get("/api/v1/storyboard/video")
def storyboard_video():  # không auth để thẻ <video> phát được
    if not os.path.exists(STORYBOARD_VIDEO):
        return JSONResponse({"error": "no video"}, status_code=404)
    return FileResponse(STORYBOARD_VIDEO, media_type="video/mp4")


# ---------- Phân tích 1 video bất kỳ (từ tab Video Affiliate) ----------
class AnalyzeBody(BaseModel):
    video_id: str
    video_url: str | None = None
    title: str = ""
    source: str = ""  # "tiktok" (aff) | "upload" (đối thủ)


# Chạy phân tích trong nền -> POST trả về NGAY (không dính timeout proxy),
# frontend poll /analysis/{id} tới khi có kết quả hoặc lỗi.
import threading  # noqa: E402
_jobs: dict[str, str] = {}  # video_id -> "running" | "error: ..."
_jobs_lock = threading.Lock()


def _run_analyze(video_id, video_url, title, source):
    import analyze as az
    try:
        az.analyze_video(video_id, video_url, title, source)
        with _jobs_lock:
            _jobs.pop(video_id, None)
    except Exception as e:  # noqa: BLE001
        with _jobs_lock:
            _jobs[video_id] = f"error: {e}"


@app.post("/api/v1/analyze")
def analyze(body: AnalyzeBody, user: dict = Depends(require_user)):
    """Khởi chạy phân tích trong NỀN. Trả {status}. Kết quả lấy qua GET /analysis/{id}."""
    import analyze as az
    cached = az.get_cached(body.video_id)
    if cached:
        return cached
    with _jobs_lock:
        running = _jobs.get(body.video_id) == "running"
        if not running:
            _jobs[body.video_id] = "running"
    if not running:
        t = threading.Thread(target=_run_analyze,
                             args=(body.video_id, body.video_url, body.title, body.source),
                             daemon=True)
        t.start()
    return {"status": "processing"}


class CommonItem(BaseModel):
    video_id: str
    source: str = ""
    video_url: str | None = None
    title: str = ""


class CommonBody(BaseModel):
    videos: list[CommonItem]


@app.post("/api/v1/analyze-common")
def analyze_common(body: CommonBody, user: dict = Depends(require_user)):
    """Chọn nhiều video -> AI tìm điểm chung."""
    if len(body.videos) < 2:
        return JSONResponse({"error": "Chọn ít nhất 2 video."}, status_code=200)
    try:
        import analyze as az
        return az.analyze_common([v.model_dump() for v in body.videos])
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)}, status_code=200)


@app.get("/api/v1/analysis/{video_id}")
def cached_analysis(video_id: str, user: dict = Depends(require_user)):
    """Đọc storyboard đã lưu (KHÔNG phân tích lại). {cached:false} nếu chưa có."""
    import analyze as az
    data = az.get_cached(video_id)
    if data:
        return data
    with _jobs_lock:
        state = _jobs.get(video_id)
    if state and state.startswith("error:"):
        return JSONResponse({"cached": False, "error": state[7:].strip()})
    return JSONResponse({"cached": False, "status": state or "idle"})


@app.get("/api/v1/history")
def history(user: dict = Depends(require_user)):
    import analyze as az
    return {"history": az.list_history()}


@app.delete("/api/v1/history/{video_id}")
def delete_history(video_id: str, user: dict = Depends(require_user)):
    import analyze as az
    return {"removed": az.delete_history(video_id)}


@app.get("/api/v1/analyze/{video_id}/video")
def analyzed_video(video_id: str):
    import analyze as az
    p = az.video_path(video_id)
    if not os.path.exists(p):
        return JSONResponse({"error": "no video"}, status_code=404)
    return FileResponse(p, media_type="video/mp4")


@app.get("/api/v1/tiktok-video/{video_id}")
def tiktok_video(video_id: str, url: str = ""):
    """Xem video trên web (tải qua server) — kể cả video giỏ hàng TikTok chặn desktop."""
    import analyze as az
    p = az.ensure_downloaded(video_id, url)
    if not p:
        return JSONResponse({"error": "Không tải được video"}, status_code=502)
    return FileResponse(p, media_type="video/mp4")


# ---------- Upload video (phân tích video đối thủ) ----------
UPLOADS = os.path.join(HERE, "uploads")
UPLOAD_INDEX = os.path.join(UPLOADS, "index.json")


def _upload_index() -> list:
    if os.path.exists(UPLOAD_INDEX):
        try:
            return json.load(open(UPLOAD_INDEX, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    return []


def _save_index(items: list):
    os.makedirs(UPLOADS, exist_ok=True)
    json.dump(items, open(UPLOAD_INDEX, "w", encoding="utf-8"), ensure_ascii=False)


@app.post("/api/v1/uploads")
def upload_video(file: UploadFile = File(...), user: dict = Depends(require_user)):
    os.makedirs(UPLOADS, exist_ok=True)
    vid = "up_" + uuid.uuid4().hex[:12]
    dest = os.path.join(UPLOADS, f"{vid}.mp4")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    rec = {"id": vid, "name": file.filename or f"{vid}.mp4",
           "size": os.path.getsize(dest), "uploaded_at": int(time.time())}
    items = _upload_index()
    items.insert(0, rec)
    _save_index(items)
    return rec


@app.get("/api/v1/uploads")
def list_uploads(user: dict = Depends(require_user)):
    return {"uploads": _upload_index()}


@app.delete("/api/v1/uploads/{video_id}")
def delete_upload(video_id: str, user: dict = Depends(require_user)):
    items = [x for x in _upload_index() if x.get("id") != video_id]
    _save_index(items)
    for p in (os.path.join(UPLOADS, f"{video_id}.mp4"),
              os.path.join(HERE, "analysis_cache", f"{video_id}.json")):
        if os.path.exists(p):
            os.remove(p)
    return {"removed": True}


# ---------- Video Affiliate ----------
def _first(d, *keys):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, "", []):
            return d[k]
    return None


def _norm(item: dict) -> dict:
    products = _first(item, "products", "product_list") or []
    prod = products[0] if isinstance(products, list) and products else {}
    return {
        "id": _first(item, "content_id", "video_id", "item_id", "id"),
        "title": _first(item, "title", "caption", "desc", "content_title") or "",
        "cover": _first(item, "cover_url", "cover", "cover_image_url", "thumbnail"),
        "video_url": _first(item, "share_url", "video_url", "play_url", "content_url"),
        "creator": _first(item, "creator_nickname", "creator_name", "username"),
        "product": _first(prod, "product_name", "title", "name"),
        "views": _first(item, "video_views", "views", "play_count"),
        "sales": _first(item, "sku_orders", "orders", "units_sold", "sold_count"),
        "gmv": _first(item, "gmv", "estimated_commission", "sales_amount"),
        "_raw": item,
    }


def _date_range(start_date: str | None, end_date: str | None):
    today = date.today()
    sd = start_date or str(today - timedelta(days=30))
    ed = end_date or str(today)
    ed_lt = str(date.fromisoformat(ed) + timedelta(days=1))  # end_date_lt loại trừ → +1
    return sd, ed_lt


@app.get("/api/v1/videos")
def videos(shop_id: str | None = None, start_date: str | None = None, end_date: str | None = None,
           sort_field: str = "gmv", sort_order: str = "DESC", user: dict = Depends(require_user)):
    """TOÀN BỘ video affiliate của shop trong khoảng ngày + tổng hợp chỉ số."""
    sd, ed_lt = _date_range(start_date, end_date)
    try:
        return tiktok.get_all_videos(shop_id, sd, ed_lt, sort_field, sort_order)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e), "videos": [], "totals": {}})


@app.get("/api/v1/videos/{video_id}/products")
def video_products(video_id: str, shop_id: str | None = None,
                   start_date: str | None = None, end_date: str | None = None,
                   user: dict = Depends(require_user)):
    sd, ed_lt = _date_range(start_date, end_date)
    try:
        return {"products": tiktok.get_video_products(shop_id, video_id, sd, ed_lt)}
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e), "products": []})


# ---------- TikTok OAuth ----------
class ConnectBody(BaseModel):
    authCode: str
    appKey: str
    appSecret: str
    serviceId: str = ""
    shopName: str = ""
    market: str = "global"


@app.post("/api/v1/tiktok/connect")
def tiktok_connect(body: ConnectBody, user: dict = Depends(require_admin)):
    """Nhận app_key/app_secret/auth_code từ form -> đổi token & THÊM shop mới."""
    try:
        shop = tiktok.add_shop(body.authCode, body.appKey, body.appSecret,
                               body.serviceId, body.shopName, body.market)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e), "connected": False}, status_code=200)
    return {"connected": shop.get("connected", False), "shop": shop}


@app.get("/api/v1/tiktok/shops")
def tiktok_shops(user: dict = Depends(require_user)):
    return {"shops": tiktok.list_shops()}


@app.delete("/api/v1/tiktok/shops/{shop_id}")
def tiktok_remove_shop(shop_id: str, user: dict = Depends(require_admin)):
    return {"removed": tiktok.remove_shop(shop_id)}


@app.get("/api/v1/tiktok/status")
def tiktok_status(user: dict = Depends(require_user)):
    return tiktok.status()


# ---------- Quản lý tài khoản (admin only) ----------
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "staff"


class UserUpdate(BaseModel):
    password: str | None = None
    role: str | None = None
    active: bool | None = None


@app.get("/api/v1/users")
def users_list(admin: dict = Depends(require_admin)):
    return {"users": users.list_users()}


@app.post("/api/v1/users")
def users_create(body: UserCreate, admin: dict = Depends(require_admin)):
    try:
        return {"user": users.create_user(body.username, body.password, body.role)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.put("/api/v1/users/{username}")
def users_update(username: str, body: UserUpdate, admin: dict = Depends(require_admin)):
    try:
        return {"user": users.update_user(username, body.password, body.role, body.active)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/v1/users/{username}")
def users_delete(username: str, admin: dict = Depends(require_admin)):
    if username == admin.get("sub"):
        raise HTTPException(400, "Không thể tự xoá chính mình")
    try:
        return {"removed": users.delete_user(username)}
    except ValueError as e:
        raise HTTPException(400, str(e))
