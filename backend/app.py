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
import sys
import time

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(__file__))
import tiktok  # noqa: E402

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


# ---------- Auth ----------
class LoginBody(BaseModel):
    userName: str
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


@app.post("/api/v1/auth/login")
def login(body: LoginBody):
    if body.userName != ADMIN_USER or body.password != ADMIN_PASS:
        raise HTTPException(401, "Sai tài khoản hoặc mật khẩu")
    return _issue(body.userName)


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


@app.get("/api/v1/videos")
def videos(page_size: int = 20, page_token: str | None = None, user: dict = Depends(require_user)):
    try:
        data = tiktok.get_affiliate_videos(page_size=page_size, page_token=page_token)
    except Exception as e:  # noqa: BLE001
        # trả 200 + {error} để frontend hiện đúng lý do (api.ts sẽ throw nếu non-2xx)
        return JSONResponse({"error": str(e), "videos": []})
    d = data.get("data") or {}
    items = _first(d, "contents", "videos", "content_list", "items") or []
    return {"videos": [_norm(x) for x in items],
            "next_page_token": _first(d, "next_page_token", "page_token"),
            "raw_sample": items[0] if items else None}


# ---------- TikTok OAuth ----------
class ConnectBody(BaseModel):
    authCode: str
    appKey: str
    appSecret: str
    serviceId: str = ""
    shopName: str = ""
    market: str = "global"


@app.post("/api/v1/tiktok/connect")
def tiktok_connect(body: ConnectBody, user: dict = Depends(require_user)):
    """Nhận app_key/app_secret/auth_code từ form -> đổi & lưu token."""
    try:
        store = tiktok.connect(body.authCode, body.appKey, body.appSecret,
                               body.serviceId, body.shopName, body.market)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e), "connected": False}, status_code=200)
    return {"connected": bool(store.get("access_token")),
            "seller_name": store.get("seller_name", "")}


@app.get("/api/v1/tiktok/status")
def tiktok_status(user: dict = Depends(require_user)):
    return tiktok.status()
