"""3 khung taxonomy + prompt — trái tim của feature (xem file THIET-KE)."""

# --- Khung 1: cỡ cảnh (đóng, vision chỉ được chọn trong list này) ---
SHOT_TYPES = [
    "Toàn cảnh", "Viễn cảnh", "Trung cảnh",
    "Trung cận cảnh", "Cận cảnh", "Đặc tả",
]

# --- Khung 2: giai đoạn kịch bản affiliate (enum section_type) ---
SECTION_TYPES = [
    "hook",          # Mở đầu thu hút
    "usp",           # Điểm bán hàng độc đáo
    "product_info",  # Thông tin sản phẩm
    "experience",    # Trải nghiệm thực tế
    "how_to",        # Hướng dẫn sử dụng
    "social_proof",  # Bằng chứng xã hội
    "cta",           # Kêu gọi hành động
]

# --- Prompt Vision: mô tả nhiều keyframe trong 1 lượt gọi ---
VISION_PROMPT = f"""Bạn là chuyên gia dựng phim quảng cáo TikTok. Dưới đây là các keyframe \
trích từ 1 video bán hàng, mỗi ảnh kèm mốc thời gian (giây) ngay trước nó.

Với TỪNG ảnh, trả về:
- "t": mốc thời gian (giây) của ảnh (số).
- "shot_type": CHỌN ĐÚNG 1 trong: {" | ".join(SHOT_TYPES)}.
- "visual_desc": 1-2 câu tiếng Việt mô tả ai/vật gì, đang làm gì, sản phẩm nào lộ rõ, bố cục.

Chỉ mô tả cái NHÌN THẤY, không suy diễn lời thoại. Trả về JSON: {{"frames": [ ... ]}}."""

# --- Prompt Segment + Analysis: 1 lượt gọi ra cả bảng lẫn phần "điểm thành công" ---
SEGMENT_PROMPT = f"""Bạn là chuyên gia kịch bản video affiliate TikTok tiếng Việt.

INPUT:
- Transcript có timestamp (lời thoại): {{transcript}}
- Mô tả hình ảnh theo mốc thời gian: {{visual}}

NGÔN NGỮ: Toàn bộ output PHẢI bằng tiếng Việt. Nếu lời thoại đầu vào KHÔNG phải tiếng Việt \
(video đối thủ nước ngoài), hãy DỊCH CHUẨN, tự nhiên sang tiếng Việt ở trường transcript của mỗi \
đoạn (giữ nguyên mốc thời gian & ý nghĩa) — TUYỆT ĐỐI không để nguyên văn tiếng nước ngoài.

NHIỆM VỤ:
1. Cắt video thành các PHÂN ĐOẠN theo dòng chảy bán hàng. Mỗi đoạn gán section_type \
trong: {" | ".join(SECTION_TYPES)} (không bắt buộc đủ hết, giữ đúng thứ tự tự nhiên của video).
   QUY TẮC CẮT ĐOẠN & GÁN NHÃN (bám sát chuẩn):
   • Tách nhỏ theo CHỨC NĂNG, đừng gộp. Đặc biệt LUÔN tách "Kêu gọi Hành động" (cta) cuối video \
thành 1 đoạn riêng, KHÔNG gộp chung với "Hướng dẫn Sử dụng" (how_to).
   • Câu "ấn giỏ hàng / kiểm tra giá / săn đơn" XEN GIỮA video là CHỐT-MỀM — vẫn thuộc đoạn \
nội dung đang nói (usp / product_info…), KHÔNG gán cta. Chỉ gán `cta` cho đoạn CUỐI chốt đơn.
   • Neo giá / nhấn giá sốc ("500 không mua, 400 không mua…") = product_info hoặc usp, không phải cta.
   - section_name: tiếng Việt NGẮN 2-4 từ, KHÔNG thêm phụ đề sau dấu ":". Ưu tiên nhãn chuẩn: \
Mở đầu Thu hút · Điểm bán hàng Độc đáo · Thông tin Sản phẩm · Trải nghiệm Thực tế · \
Hướng dẫn Sử dụng · Kêu gọi Hành động.
   - start/end: giây (số nguyên). shot_type gộp từ các frame rơi vào đoạn.
   - visual_desc: gộp mô tả hình ảnh của đoạn. transcript: gộp lời thoại của đoạn.
2. Viết "success_analysis":
   - "points": 4-6 gạch đầu dòng, mỗi dòng 1 ĐÒN BẨY tâm lý bán hàng (tò mò, giá trị/kinh tế, \
USP giải quyết nỗi đau, tạo niềm tin, khan hiếm + ưu đãi thúc CTA) và cách video dùng nó.
   - "filming_technique": 1 đoạn phân tích cỡ cảnh chủ đạo, chuyển động máy, cách zoom, bố cục sản phẩm.

Trả về JSON đúng schema đã cho."""

# JSON schema cho structured output (Claude output_config.format)
STORYBOARD_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "storyboard": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "section_name": {"type": "string"},
                    "section_type": {"type": "string", "enum": SECTION_TYPES},
                    "start": {"type": "integer"},
                    "end": {"type": "integer"},
                    "shot_type": {"type": "string", "enum": SHOT_TYPES},
                    "visual_desc": {"type": "string"},
                    "transcript": {"type": "string"},
                },
                "required": ["section_name", "section_type", "start", "end",
                             "shot_type", "visual_desc", "transcript"],
            },
        },
        "success_analysis": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "points": {"type": "array", "items": {"type": "string"}},
                "filming_technique": {"type": "string"},
            },
            "required": ["points", "filming_technique"],
        },
    },
    "required": ["storyboard", "success_analysis"],
}
