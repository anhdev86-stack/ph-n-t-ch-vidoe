#!/usr/bin/env bash
# Tạo venv riêng (tránh lỗi PEP 668 externally-managed của Python hệ thống) + cài deps.
set -e
cd "$(dirname "$0")"

echo "→ Tạo venv .venv"
python3 -m venv .venv
source .venv/bin/activate

echo "→ Cài anthropic (bắt buộc)"
pip install --quiet --upgrade pip
pip install --quiet anthropic

echo "→ Thử cài faster-whisper (ASR). Nếu lỗi trên Python mới, dùng whisper.cpp hoặc --transcript"
pip install --quiet faster-whisper || echo "  ⚠ faster-whisper cài không được — xem README mục ASR thay thế"

echo ""
echo "✓ Xong. Kích hoạt:  source .venv/bin/activate"
echo "  Chạy thử:  export ANTHROPIC_API_KEY=sk-ant-...  &&  python run.py video.mp4"
