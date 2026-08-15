"""Bước ② ASR: tách lời thoại có timestamp. Backend cắm-rút, tự dò cái nào có sẵn.

Thứ tự ưu tiên:
  1. faster-whisper (pip, chạy CPU được — tốt nhất cho tiếng Việt)
  2. whisper.cpp (binary `whisper-cli` từ `brew install whisper-cpp`)
  3. --transcript ngoài: file .srt hoặc .json  (đảm bảo MVP luôn chạy được)
"""
import json
import os
import re
import shutil
import subprocess
import threading

# Nạp model Whisper 1 LẦN rồi dùng chung (tránh mỗi request nạp lại ~1GB RAM -> cạn RAM khi đông).
# Serialize ASR bằng lock: Whisper ngốn CPU, chạy 1 lượt/lần để nhiều người không làm nghẽn CPU.
_WMODEL = None
_WMODEL_LOCK = threading.Lock()
_ASR_LOCK = threading.Lock()


def _get_whisper(model_size: str = "small"):
    global _WMODEL
    if _WMODEL is None:
        with _WMODEL_LOCK:
            if _WMODEL is None:
                from faster_whisper import WhisperModel
                _WMODEL = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _WMODEL


def _from_faster_whisper(wav_path: str, model_size: str = "small", language: str | None = "vi"):
    model = _get_whisper(model_size)
    # language=None -> tự nhận diện (dùng cho video đối thủ tiếng nước ngoài)
    with _ASR_LOCK:  # 1 ASR/lần -> tránh 90 người cùng chạy Whisper làm treo CPU
        segments, _ = model.transcribe(wav_path, language=language, vad_filter=True)
        return [{"start": round(s.start, 1), "end": round(s.end, 1),
                 "text": s.text.strip()} for s in segments]


def _from_whisper_cpp(wav_path: str, model_size: str = "small"):
    binary = shutil.which("whisper-cli") or shutil.which("whisper-cpp")
    model_env = os.environ.get("WHISPER_CPP_MODEL")  # đường dẫn file ggml-*.bin
    if not model_env:
        raise RuntimeError("Đặt WHISPER_CPP_MODEL=/path/ggml-small.bin để dùng whisper.cpp")
    out_prefix = wav_path + ".wcpp"
    subprocess.run(
        [binary, "-m", model_env, "-l", "vi", "-f", wav_path,
         "-oj", "-of", out_prefix],
        capture_output=True, check=True,
    )
    with open(out_prefix + ".json", encoding="utf-8") as f:
        data = json.load(f)
    segs = []
    for t in data.get("transcription", []):
        off = t.get("offsets", {})
        segs.append({"start": round(off.get("from", 0) / 1000, 1),
                     "end": round(off.get("to", 0) / 1000, 1),
                     "text": t.get("text", "").strip()})
    return segs


def _parse_srt(path: str):
    """Nạp transcript từ file .srt có sẵn."""
    text = open(path, encoding="utf-8").read()
    blocks = re.split(r"\n\s*\n", text.strip())
    ts = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)")

    def to_sec(m):
        h, mn, s, ms = map(int, m.groups())
        return h * 3600 + mn * 60 + s + ms / 1000

    segs = []
    for b in blocks:
        lines = [ln for ln in b.splitlines() if ln.strip()]
        if len(lines) < 2:
            continue
        arrow = next((ln for ln in lines if "-->" in ln), None)
        if not arrow:
            continue
        times = ts.findall(arrow)
        if len(times) < 2:
            continue
        start = to_sec(re.match(ts, arrow.split("-->")[0].strip()))
        end = to_sec(re.match(ts, arrow.split("-->")[1].strip()))
        txt = " ".join(lines[lines.index(arrow) + 1:]).strip()
        segs.append({"start": round(start, 1), "end": round(end, 1), "text": txt})
    return segs


def transcribe(wav_path: str, model_size: str = "small", transcript_file: str | None = None,
               language: str | None = "vi"):
    """Chạy ASR với backend đầu tiên khả dụng. language=None -> tự nhận diện."""
    if transcript_file:
        if transcript_file.lower().endswith(".json"):
            return json.load(open(transcript_file, encoding="utf-8"))
        return _parse_srt(transcript_file)

    try:
        import faster_whisper  # noqa: F401
        print(f"  → ASR: faster-whisper (lang={language or 'auto'})")
        return _from_faster_whisper(wav_path, model_size, language)
    except ImportError:
        pass

    if shutil.which("whisper-cli") or shutil.which("whisper-cpp"):
        print("  → ASR: whisper.cpp")
        return _from_whisper_cpp(wav_path, model_size)

    raise RuntimeError(
        "Không có backend ASR. Chọn 1:\n"
        "  • pip install faster-whisper  (trong venv)\n"
        "  • brew install whisper-cpp  +  export WHISPER_CPP_MODEL=/path/ggml-small.bin\n"
        "  • hoặc chạy lại với  --transcript <file.srt|.json>"
    )
