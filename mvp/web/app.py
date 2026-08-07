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

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

HERE = os.path.dirname(__file__)
MVP = os.path.dirname(HERE)

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
