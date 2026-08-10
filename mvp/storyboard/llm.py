"""Bước ③ Vision + ④ Segment/Analysis — dùng Claude làm engine suy luận."""
import base64
import json
import os

import anthropic

from . import prompts

# Mặc định Claude Opus 5 (mạnh nhất). Đổi model qua env MODEL, vd MODEL=claude-sonnet-5 cho rẻ hơn.
MODEL = os.environ.get("MODEL", "claude-sonnet-5")
# timeout cứng để 1 call chậm bất thường không treo mãi; max_retries=1 tránh nhân đôi thời gian
_client = anthropic.Anthropic(timeout=180.0, max_retries=1)  # đọc ANTHROPIC_API_KEY từ môi trường


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


def find_common(video_briefs: list) -> dict:
    """Tìm điểm chung giữa nhiều video (structured output)."""
    prompt = prompts.COMMON_PROMPT.format(
        n=len(video_briefs),
        videos=json.dumps(video_briefs, ensure_ascii=False),
    )
    resp = _client.messages.create(
        model=MODEL, max_tokens=4000,
        output_config={"format": {"type": "json_schema", "schema": prompts.COMMON_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    text = next((b.text for b in resp.content if b.type == "text"), "{}")
    return _loads(text)


def shop_insights(videos: list, storyboards: list, context: str = "") -> dict:
    """Trợ lý phân tích: đọc top video (số liệu) + storyboard vài video top -> công thức content.
    videos: [{title, creator, product, gmv, orders, views, ctr, cvr, gpm}]
    storyboards: [{title, scenes:[{phan_canh, co_canh, loi_thoai}], diem_thanh_cong:[...]}]
    """
    def _fmt_v(v):
        return (f"{v.get('title','')[:70]} | {v.get('creator','')} | {v.get('product','') or '-'} | "
                f"GMV {v.get('gmv',0)} | {v.get('orders',0)} đơn | {v.get('views',0)} view | "
                f"CTR {v.get('ctr',0)}% | CVR {v.get('cvr',0)}% | GPM {v.get('gpm',0)}")
    prompt = prompts.INSIGHTS_PROMPT.format(
        context=context or "(không có)",
        videos="\n".join(_fmt_v(v) for v in videos) or "(trống)",
        storyboards=json.dumps(storyboards, ensure_ascii=False)[:8000] if storyboards else "(chưa có video top nào được phân tích storyboard)",
    )
    # thử tối đa 2 lần: structured output đôi khi trả rỗng -> retry
    data = {}
    for _ in range(2):
        resp = _client.messages.create(
            model=MODEL, max_tokens=8000,
            output_config={"format": {"type": "json_schema", "schema": prompts.INSIGHTS_SCHEMA}},
            messages=[{"role": "user", "content": prompt}],
        )
        # GHÉP TẤT CẢ text block (response có thể tách nhiều block -> lấy 1 block sẽ cụt JSON)
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        data = _loads(text)
        if data.get("tong_quan") or data.get("cong_thuc_thang"):
            return data
    return data


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
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                return {}
        return {}
