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

# --- Prompt tìm ĐIỂM CHUNG nhiều video ---
COMMON_PROMPT = (
    "Bạn là chuyên gia phân tích video bán hàng/affiliate TikTok. Dưới đây là storyboard "
    "+ phân tích của {n} video (đã cắt phân cảnh, lời thoại, cỡ cảnh, điểm thành công).\n\n"
    "DỮ LIỆU:\n{videos}\n\n"
    "NHIỆM VỤ: Tìm ĐIỂM CHUNG — những mô-típ lặp lại giữa các video này (thứ khiến chúng "
    "giống nhau về công thức thành công). Viết BẰNG TIẾNG VIỆT, cụ thể, có thể áp dụng ngay.\n"
    "Trả về JSON: diem_chung (mảng 4-8 câu điểm chung nổi bật nhất), cau_truc_chung (khung kịch bản "
    "lặp lại), hook_chung (cách mở đầu chung), thong_diep_chung (USP/thông điệp bán hàng chung), "
    "ky_thuat_quay_chung (cỡ cảnh/chuyển động máy chung), goi_y (gợi ý làm 1 video mới bám công thức chung này)."
)

COMMON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["diem_chung", "cau_truc_chung", "hook_chung", "thong_diep_chung",
                 "ky_thuat_quay_chung", "goi_y"],
    "properties": {
        "diem_chung": {"type": "array", "items": {"type": "string"}},
        "cau_truc_chung": {"type": "string"},
        "hook_chung": {"type": "string"},
        "thong_diep_chung": {"type": "string"},
        "ky_thuat_quay_chung": {"type": "string"},
        "goi_y": {"type": "string"},
    },
}

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


# ================= Trợ lý phân tích thông minh (Shop Insights) =================
INSIGHTS_PROMPT = """Bạn là CHUYÊN GIA TĂNG TRƯỞNG TikTok Shop affiliate cấp cao ở Việt Nam, \
đọc số liệu để tìm ra CÔNG THỨC nội dung ra đơn. Dưới đây là dữ liệu thật của shop.

Bối cảnh: {context}

TOP video (đã sắp theo GMV, đơn vị tiền VND). Mỗi dòng: tiêu đề | người đăng | sản phẩm | \
GMV | đơn | lượt xem | CTR% | CVR% | GPM:
{videos}

Storyboard chi tiết của vài video top (để hiểu VÌ SAO chúng ra đơn — hook, cấu trúc, cỡ cảnh, lời thoại):
{storyboards}

Hãy phân tích như một cố vấn thực chiến, KHÔNG nói chung chung. Yêu cầu:
- Dựa vào SỐ LIỆU thật để rút "công thức thắng" (yếu tố lặp lại ở các video GMV/CVR cao).
- Mỗi kết luận nêu BẰNG CHỨNG (số liệu hoặc video nào).
- Gợi ý phải HÀNH ĐỘNG ĐƯỢC NGAY (creator có thể áp dụng làm video mới).
- So sánh video thắng vs video kém để chỉ ra khác biệt quyết định.
- Viết tiếng Việt, ngắn gọn, đúng trọng tâm.

Trả về JSON đúng schema."""

INSIGHTS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "tong_quan": {"type": "string"},  # 2-4 câu nhận định hiệu suất tổng thể
        "cong_thuc_thang": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "yeu_to": {"type": "string"},    # VD: Hook, Cấu trúc, Cỡ cảnh, Lời thoại, Độ dài
                    "mo_ta": {"type": "string"},     # công thức cụ thể áp dụng được
                    "bang_chung": {"type": "string"},  # số liệu / video minh chứng
                },
                "required": ["yeu_to", "mo_ta", "bang_chung"],
            },
        },
        "hook_hieu_qua": {"type": "array", "items": {"type": "string"}},   # các mẫu hook nên dùng
        "san_pham_nen_day": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {"ten": {"type": "string"}, "ly_do": {"type": "string"}},
                "required": ["ten", "ly_do"],
            },
        },
        "goi_y_dinh_dang": {"type": "array", "items": {"type": "string"}},  # định dạng/độ dài/CTA nên dùng
        "canh_bao": {"type": "array", "items": {"type": "string"}},         # điều nên tránh
    },
    "required": ["tong_quan", "cong_thuc_thang", "hook_hieu_qua",
                 "san_pham_nen_day", "goi_y_dinh_dang", "canh_bao"],
}
