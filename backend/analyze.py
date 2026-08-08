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


def _has_video_stream(path: str) -> bool:
    """ffprobe: file có luồng video không (tránh cache nhầm file audio-only -> đen hình)."""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                            "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
                           capture_output=True, text=True, timeout=20)
        return "video" in r.stdout
    except Exception:  # noqa: BLE001
        return True  # ffprobe lỗi -> cứ cho qua, không chặn


def ensure_downloaded(video_id: str, video_url: str = "", cookies: str = "") -> str | None:
    """Trả path mp4 của video; tải bằng yt-dlp nếu chưa có. cookies (Netscape) = phiên
    đăng nhập TikTok của shop -> tải được cả video GIỎ HÀNG (TikTok chỉ trả video khi đã login).
    None nếu tải thất bại."""
    up = upload_path(video_id)
    if os.path.exists(up):
        return up
    mp4 = os.path.join(VIDEOS, f"{video_id}.mp4")
    if os.path.exists(mp4):
        if _has_video_stream(mp4):
            return mp4
        os.remove(mp4)  # file hỏng (audio-only) -> tải lại
    os.makedirs(VIDEOS, exist_ok=True)
    url = video_url or f"https://www.tiktok.com/@_/video/{video_id}"
    args = [sys.executable, "-m", "yt_dlp",
            "-f", "bv*+ba/b", "-S", "vcodec:h264,res,acodec:aac",
            "--merge-output-format", "mp4", "--no-playlist",
            "--impersonate", "chrome"]  # giả lập trình duyệt (cần curl_cffi)
    ck_file = None
    if cookies and cookies.strip():
        ck_file = os.path.join(VIDEOS, f".ck_{video_id}.txt")
        with open(ck_file, "w", encoding="utf-8") as f:
            f.write(cookies)
        args += ["--cookies", ck_file]
    args += ["-o", mp4, url]
    try:
        r = subprocess.run(args, capture_output=True, text=True)
    finally:
        if ck_file and os.path.exists(ck_file):
            os.remove(ck_file)
    global _LAST_YTDLP_LOG
    _LAST_YTDLP_LOG = (f"rc={r.returncode} exists={os.path.exists(mp4)} "
                       f"has_video={_has_video_stream(mp4) if os.path.exists(mp4) else 'n/a'} "
                       f"cookies={'yes' if (cookies and cookies.strip()) else 'no'}\n"
                       f"STDERR:\n{r.stderr[-1500:]}\nSTDOUT:\n{r.stdout[-500:]}")
    return mp4 if (r.returncode == 0 and os.path.exists(mp4) and _has_video_stream(mp4)) else None


_LAST_YTDLP_LOG = ""


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


def analyze_common(items: list) -> dict:
    """Lấy storyboard từng video (ưu tiên cache) rồi Claude tìm ĐIỂM CHUNG.
    items: [{video_id, source?, video_url?, title?}]
    """
    briefs = []
    for it in items:
        vid = it.get("video_id")
        sb = get_cached(vid) or analyze_video(vid, it.get("video_url"),
                                              it.get("title", ""), it.get("source", ""))
        briefs.append({
            "title": it.get("title") or vid,
            "phan_canh": [{"ten": s.get("phan_canh"), "co_canh": s.get("co_canh"),
                           "loi_thoai": s.get("kich_ban_am_thanh")}
                          for s in sb.get("kich_ban_video", [])],
            "diem_thanh_cong": (sb.get("giai_thich_diem_thanh_cong") or {}).get("points", []),
        })
    from storyboard import llm
    common = llm.find_common(briefs)
    return {"count": len(briefs),
            "videos": [{"video_id": it.get("video_id"), "title": it.get("title") or it.get("video_id")} for it in items],
            "common": common}


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
            r = subprocess.run([sys.executable, "-m", "yt_dlp",
                                "-f", "bv*+ba/b", "-S", "vcodec:h264,res,acodec:aac",
                                "--merge-output-format", "mp4", "--no-playlist",
                                "-o", mp4, url],
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
