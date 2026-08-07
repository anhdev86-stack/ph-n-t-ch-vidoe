"""Phân tích 1 video (TikTok) -> storyboard, tái dùng pipeline MVP.

Tải video bằng yt-dlp → ffmpeg tách audio+keyframe → ASR → Claude vision + cắt đoạn.
Kết quả map sang đúng field frontend (kich_ban_video + giai_thich_diem_thanh_cong),
cache theo video_id.

Cần: ANTHROPIC_API_KEY (cho Claude), ffmpeg, yt-dlp, và 1 backend ASR (faster-whisper).
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(__file__)
MVP = os.path.join(os.path.dirname(HERE), "mvp")
sys.path.insert(0, MVP)

CACHE = os.path.join(HERE, "analysis_cache")
VIDEOS = os.path.join(HERE, "analysis_videos")
UPLOADS = os.path.join(HERE, "uploads")


def upload_path(video_id: str) -> str:
    return os.path.join(UPLOADS, f"{video_id}.mp4")


def video_path(video_id: str) -> str:
    up = upload_path(video_id)
    return up if os.path.exists(up) else os.path.join(VIDEOS, f"{video_id}.mp4")


# ---------- lịch sử phân tích ----------
import time  # noqa: E402

HISTORY = os.path.join(CACHE, "history.json")


def _load_history() -> list:
    if os.path.exists(HISTORY):
        try:
            return json.load(open(HISTORY, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    return []


def _save_history(items: list):
    os.makedirs(CACHE, exist_ok=True)
    json.dump(items, open(HISTORY, "w", encoding="utf-8"), ensure_ascii=False)


def _detect_source(video_id: str) -> str:
    return "upload" if os.path.exists(upload_path(video_id)) else "tiktok"


def _record_history(video_id: str, source: str, title: str):
    items = _load_history()
    for it in items:
        if it["video_id"] == video_id:            # đã có -> cập nhật nhẹ
            if title:
                it["title"] = title
            it["source"] = source or it.get("source")
            _save_history(items)
            return
    items.insert(0, {"video_id": video_id, "source": source,
                     "title": title or video_id, "analyzed_at": int(time.time())})
    _save_history(items)


def list_history() -> list:
    return sorted(_load_history(), key=lambda x: x.get("analyzed_at", 0), reverse=True)


def get_cached(video_id: str) -> dict | None:
    """Đọc storyboard ĐÃ LƯU (không phân tích lại). None nếu chưa có."""
    cf = os.path.join(CACHE, f"{video_id}.json")
    if os.path.exists(cf):
        try:
            return json.load(open(cf, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return None
    return None


def delete_history(video_id: str) -> bool:
    items = [x for x in _load_history() if x["video_id"] != video_id]
    _save_history(items)
    cf = os.path.join(CACHE, f"{video_id}.json")
    if os.path.exists(cf):
        os.remove(cf)
    return True


def _map(mvp_result: dict) -> dict:
    """MVP output -> field shape của frontend/Kaloclip."""
    kb = [{
        "phan_canh": s.get("section_name", ""),
        "timestamp": f"{s.get('start', 0)}~{s.get('end', 0)}s",
        "co_canh": s.get("shot_type", ""),
        "mo_ta_hinh_anh": s.get("visual_desc", ""),
        "kich_ban_am_thanh": s.get("transcript", ""),
    } for s in mvp_result.get("storyboard", [])]
    sa = mvp_result.get("success_analysis", {})
    return {"kich_ban_video": kb,
            "giai_thich_diem_thanh_cong": {
                "points": sa.get("points", []),
                "ky_thuat_quay_phim": sa.get("filming_technique", "")}}


def analyze_video(video_id: str, video_url: str | None = None,
                  title: str = "", source: str = "") -> dict:
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(VIDEOS, exist_ok=True)
    src = source or _detect_source(video_id)
    cache_file = os.path.join(CACHE, f"{video_id}.json")
    if os.path.exists(cache_file):
        _record_history(video_id, src, title)
        return json.load(open(cache_file, encoding="utf-8"))

    # 1) nguồn video: file upload có sẵn, hoặc tải từ TikTok
    is_upload = os.path.exists(upload_path(video_id))
    if is_upload:
        mp4 = upload_path(video_id)
    else:
        mp4 = os.path.join(VIDEOS, f"{video_id}.mp4")
        if not os.path.exists(mp4):
            url = video_url or f"https://www.tiktok.com/@_/video/{video_id}"
            r = subprocess.run([sys.executable, "-m", "yt_dlp", "-f", "mp4/best",
                                "--no-playlist", "-o", mp4, url],
                               capture_output=True, text=True)
            if r.returncode != 0 or not os.path.exists(mp4):
                raise RuntimeError(f"Tải video thất bại (yt-dlp): {r.stderr[-300:] or r.stdout[-300:]}")

    # 2) pipeline MVP. Video upload (đối thủ) -> auto nhận diện ngôn ngữ; prompt sẽ dịch sang tiếng Việt.
    from storyboard import media, asr, llm  # import trễ để backend khởi động không phụ thuộc
    with tempfile.TemporaryDirectory() as tmp:
        wav = media.extract_audio(mp4, os.path.join(tmp, "a.wav"))
        frames = media.extract_keyframes(mp4, os.path.join(tmp, "f"), interval=3.0)
        transcript = asr.transcribe(wav, language=None if is_upload else "vi")
        visual = llm.describe_frames(frames)       # Claude vision
        result = llm.segment_and_analyze(transcript, visual)

    mapped = _map(result)
    json.dump(mapped, open(cache_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    _record_history(video_id, src, title)
    return mapped
