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


def video_path(video_id: str) -> str:
    return os.path.join(VIDEOS, f"{video_id}.mp4")


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


def analyze_video(video_id: str, video_url: str | None = None) -> dict:
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(VIDEOS, exist_ok=True)
    cache_file = os.path.join(CACHE, f"{video_id}.json")
    if os.path.exists(cache_file):
        return json.load(open(cache_file, encoding="utf-8"))

    # 1) tải video
    mp4 = video_path(video_id)
    if not os.path.exists(mp4):
        url = video_url or f"https://www.tiktok.com/@_/video/{video_id}"
        r = subprocess.run([sys.executable, "-m", "yt_dlp", "-f", "mp4/best",
                            "--no-playlist", "-o", mp4, url],
                           capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(mp4):
            raise RuntimeError(f"Tải video thất bại (yt-dlp): {r.stderr[-300:] or r.stdout[-300:]}")

    # 2) pipeline MVP
    from storyboard import media, asr, llm  # import trễ để backend khởi động không phụ thuộc
    with tempfile.TemporaryDirectory() as tmp:
        wav = media.extract_audio(mp4, os.path.join(tmp, "a.wav"))
        frames = media.extract_keyframes(mp4, os.path.join(tmp, "f"), interval=3.0)
        transcript = asr.transcribe(wav)          # cần ASR backend
        visual = llm.describe_frames(frames)       # Claude vision
        result = llm.segment_and_analyze(transcript, visual)

    mapped = _map(result)
    json.dump(mapped, open(cache_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return mapped
