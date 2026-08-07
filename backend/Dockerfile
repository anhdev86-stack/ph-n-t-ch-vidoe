# Backend FastAPI: Claude + ASR (faster-whisper) + ffmpeg + yt-dlp
# Build context = GỐC repo (vì cần copy cả mvp/storyboard).
#   docker build -f backend/Dockerfile .
FROM python:3.12-slim

# ffmpeg cho tách audio/keyframe; ca-certificates cho HTTPS
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài deps trước để tận dụng layer cache
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Mã nguồn: backend + package storyboard + ground-truth
COPY backend/ ./backend/
COPY mvp/storyboard/ ./mvp/storyboard/
COPY mvp/ground-truth/ ./mvp/ground-truth/

# Thư mục dữ liệu bền (mount volume ở compose)
RUN mkdir -p /app/backend/analysis_cache /app/backend/analysis_videos /app/backend/uploads

# Model whisper tải về nằm trong cache volume → không tải lại mỗi lần deploy
ENV HF_HOME=/app/backend/analysis_cache/hf \
    TTS_TOKEN_FILE=/app/backend/analysis_cache/.tts_token.json \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
