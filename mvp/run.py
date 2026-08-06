#!/usr/bin/env python3
"""Video sang Storyboard — pipeline hoàn chỉnh.

Cách chạy:
    export ANTHROPIC_API_KEY=sk-ant-...
    python run.py video.mp4
    python run.py video.mp4 --transcript loi.srt   # nạp transcript có sẵn (bỏ qua ASR)

Kết quả: out/<tên>.json  +  out/<tên>.html (mở bằng trình duyệt)
"""
import argparse
import hashlib
import os
import sys
import tempfile

from storyboard import asr, llm, media, render


def _cache_key(video_path: str) -> str:
    """Cache theo nội dung video — giống Kaloclip cache theo video_id."""
    h = hashlib.sha256()
    with open(video_path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser(description="Video → Storyboard")
    ap.add_argument("video", help="Đường dẫn file video (mp4/mov/...)")
    ap.add_argument("--transcript", help="File .srt/.json transcript có sẵn (bỏ qua ASR)")
    ap.add_argument("--interval", type=float, default=3.0, help="Giây/keyframe (mặc định 3)")
    ap.add_argument("--asr-model", default="small", help="Kích thước model Whisper")
    ap.add_argument("--out", default="out", help="Thư mục kết quả")
    ap.add_argument("--force", action="store_true", help="Bỏ qua cache, chạy lại")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        sys.exit(f"Không thấy file: {args.video}")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Chưa đặt ANTHROPIC_API_KEY (export ANTHROPIC_API_KEY=sk-ant-...)")

    os.makedirs(args.out, exist_ok=True)
    name = os.path.splitext(os.path.basename(args.video))[0]
    key = _cache_key(args.video)
    json_path = os.path.join(args.out, f"{name}.{key}.json")
    html_path = os.path.join(args.out, f"{name}.{key}.html")

    # --- Cache: mở lại thì đọc, không chạy lại (giống Kaloclip) ---
    if os.path.exists(json_path) and not args.force:
        print(f"✓ Đã có cache: {json_path} (dùng --force để chạy lại)")
        import json
        render.render_html(json.load(open(json_path, encoding="utf-8")), html_path)
        print(f"✓ HTML: {html_path}")
        return

    with tempfile.TemporaryDirectory() as tmp:
        # ① INGEST
        print("① Tách audio + trích keyframe…")
        wav = media.extract_audio(args.video, os.path.join(tmp, "audio.wav"))
        frames = media.extract_keyframes(args.video, os.path.join(tmp, "frames"),
                                         interval=args.interval)
        print(f"   {len(frames)} keyframe")

        # ② ASR
        print("② Bóc lời thoại (ASR)…")
        transcript = asr.transcribe(wav, args.asr_model, args.transcript)
        print(f"   {len(transcript)} câu")

        # ③ VISION
        print("③ Vision: mô tả cỡ cảnh + hình ảnh…")
        visual = llm.describe_frames(frames)
        print(f"   {len(visual)} mô tả")

        # ④ SEGMENT + ANALYSIS
        print("④ Cắt đoạn theo khung marketing + phân tích điểm thành công…")
        result = llm.segment_and_analyze(transcript, visual)

    render.save_json(result, json_path)
    render.render_html(result, html_path)
    print(f"\n✓ JSON: {json_path}\n✓ HTML: {html_path}")


if __name__ == "__main__":
    main()
