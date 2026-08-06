"""Bước ① INGEST: dùng ffmpeg tách audio + trích keyframe."""
import json
import os
import subprocess


def probe_duration(video_path: str) -> float:
    """Lấy độ dài video (giây) bằng ffprobe."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", video_path],
        capture_output=True, text=True, check=True,
    )
    return float(json.loads(out.stdout)["format"]["duration"])


def extract_audio(video_path: str, out_wav: str) -> str:
    """Tách audio về WAV 16kHz mono — định dạng chuẩn cho mọi ASR."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-vn",
         "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out_wav],
        capture_output=True, check=True,
    )
    return out_wav


def extract_keyframes(video_path: str, out_dir: str, interval: float = 3.0):
    """Trích 1 keyframe mỗi `interval` giây. Trả về [(t_giây, đường_dẫn_ảnh)].

    MVP dùng lấy mẫu đều cho chắc chắn. Nâng cấp: scene-detect
    (-vf select='gt(scene,0.3)') để bám đúng ranh giới cảnh quay.
    """
    os.makedirs(out_dir, exist_ok=True)
    duration = probe_duration(video_path)
    frames = []
    t = 0.0
    idx = 0
    while t < duration:
        out_img = os.path.join(out_dir, f"frame_{idx:04d}.jpg")
        subprocess.run(
            ["ffmpeg", "-y", "-ss", f"{t:.2f}", "-i", video_path,
             "-frames:v", "1", "-q:v", "3", "-vf", "scale=512:-1", out_img],
            capture_output=True, check=True,
        )
        if os.path.exists(out_img):
            frames.append((round(t, 1), out_img))
        t += interval
        idx += 1
    return frames
