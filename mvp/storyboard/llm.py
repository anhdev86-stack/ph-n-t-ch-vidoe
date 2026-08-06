"""Bước ③ Vision + ④ Segment/Analysis — dùng Claude làm engine suy luận."""
import base64
import json
import os

import anthropic

from . import prompts

# Mặc định Claude Opus 5 (mạnh nhất). Đổi model qua env MODEL, vd MODEL=claude-sonnet-5 cho rẻ hơn.
MODEL = os.environ.get("MODEL", "claude-opus-5")
_client = anthropic.Anthropic()  # đọc ANTHROPIC_API_KEY từ môi trường


def _img_block(path: str):
    data = base64.standard_b64encode(open(path, "rb").read()).decode()
    return {"type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}


def describe_frames(frames, batch: int = 12):
    """Vision: mô tả cỡ cảnh + nội dung từng keyframe. Gộp nhiều ảnh/lượt gọi cho rẻ.

    frames: [(t_giây, đường_dẫn_ảnh)] → trả [{t, shot_type, visual_desc}].
    """
    results = []
    for i in range(0, len(frames), batch):
        chunk = frames[i:i + batch]
        content = [{"type": "text", "text": prompts.VISION_PROMPT}]
        for t, path in chunk:
            content.append({"type": "text", "text": f"[t={t}s]"})
            content.append(_img_block(path))
        resp = _client.messages.create(
            model=MODEL, max_tokens=4000,
            messages=[{"role": "user", "content": content}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), "{}")
        results.extend(_loads(text).get("frames", []))
    return results


def segment_and_analyze(transcript, visual):
    """Segment theo khung marketing + sinh phần 'điểm thành công'. Structured output."""
    prompt = prompts.SEGMENT_PROMPT.format(
        transcript=json.dumps(transcript, ensure_ascii=False),
        visual=json.dumps(visual, ensure_ascii=False),
    )
    resp = _client.messages.create(
        model=MODEL, max_tokens=8000,
        output_config={"format": {"type": "json_schema",
                                  "schema": prompts.STORYBOARD_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    text = next((b.text for b in resp.content if b.type == "text"), "{}")
    return _loads(text)


def _loads(text: str) -> dict:
    """Parse JSON, chịu được trường hợp model bọc trong ```json ... ```."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        return json.loads(text[start:end + 1]) if start >= 0 else {}
