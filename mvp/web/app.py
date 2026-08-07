"""Viewer web giống Kaloclip — hiển thị 2 phần: Kịch bản video + Giải thích điểm thành công.

Chạy:
    cd mvp
    ./.venv/bin/uvicorn web.app:app --reload --port 8000
Mở: http://localhost:8000

Dữ liệu lấy từ GET /api/storyboard (mặc định đọc file ground-truth mẫu).
=> Sau này anh chỉ cần thay hàm load_storyboard() bằng lời gọi API video aff là xong.
"""
import json
import os
import sys

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

HERE = os.path.dirname(__file__)
MVP = os.path.dirname(HERE)
sys.path.insert(0, HERE)  # để `import tiktok` chạy dù khởi động từ đâu

# --- CHỖ ĐẤU NỐI SAU: đổi 2 hằng số này (hoặc thay load_storyboard) sang API thật ---
DATA_FILE = os.environ.get(
    "STORYBOARD_JSON",
    os.path.join(MVP, "ground-truth", "7653105429953645844.kalodata.json"),
)
VIDEO_FILE = os.environ.get(
    "STORYBOARD_VIDEO",
    os.path.join(MVP, "samples", "7653105429953645844.mp4"),
)

app = FastAPI(title="Video sang Storyboard — Viewer")
app.mount("/static", StaticFiles(directory=os.path.join(HERE, "static")), name="static")


def load_storyboard() -> dict:
    """Trả về dữ liệu 2 phần. Sau này thay bằng gọi API video aff / pipeline."""
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


@app.get("/")
def index():
    return FileResponse(os.path.join(HERE, "static", "index.html"))


@app.get("/api/storyboard")
def storyboard():
    return JSONResponse(load_storyboard())


@app.get("/api/video")
def video():
    if not os.path.exists(VIDEO_FILE):
        return JSONResponse({"error": "no video"}, status_code=404)
    return FileResponse(VIDEO_FILE, media_type="video/mp4")


# ---------- TikTok Shop Affiliate: list video gắn sản phẩm ----------
def _first(d: dict, *keys):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, "", []):
            return d[k]
    return None


def _normalize_video(item: dict) -> dict:
    """Map phòng thủ sang field UI. Chưa chốt schema TikTok -> giữ cả _raw để chỉnh."""
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


@app.get("/api/videos")
def videos(page_size: int = 20, page_token: str | None = None):
    try:
        import tiktok  # import trễ để trang chạy được kể cả khi chưa cấu hình TikTok
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": f"import tiktok lỗi: {e}"}, status_code=500)
    try:
        data = tiktok.get_affiliate_videos(page_size=page_size, page_token=page_token)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)}, status_code=502)
    d = data.get("data") or {}
    items = _first(d, "contents", "videos", "content_list", "items") or []
    return JSONResponse({
        "videos": [_normalize_video(x) for x in items],
        "next_page_token": _first(d, "next_page_token", "page_token"),
        "total": _first(d, "total_count", "total"),
        "raw_sample": items[0] if items else None,  # để đối chiếu & chốt mapping
    })


@app.get("/videos")
def videos_page():
    return FileResponse(os.path.join(HERE, "static", "videos.html"))


# ---------- OAuth TikTok Shop ----------
@app.get("/auth/tiktok/login")
def tiktok_login():
    import tiktok
    try:
        return RedirectResponse(tiktok.authorize_url())
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/auth/tiktok/callback")
def tiktok_callback(code: str | None = None, auth_code: str | None = None):
    """TikTok redirect về đây kèm ?code=<auth_code>. Đổi lấy token rồi về /videos."""
    import tiktok
    ac = code or auth_code
    if not ac:
        return JSONResponse({"error": "thiếu code (auth_code) trên callback"}, status_code=400)
    try:
        store = tiktok.get_access_token(ac)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)}, status_code=502)
    return RedirectResponse(f"/videos?authorized={1 if store.get('access_token') else 0}")
