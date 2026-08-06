# FULL PROMPT — Video sang Storyboard (bản hoàn chỉnh, copy-paste chạy được)

> Bộ prompt đầy đủ để tái tạo output của Kaloclip (2 phần: Kịch bản video + Giải thích điểm thành công).
> Đã kiểm chứng: cho ra khớp 6/6 phân cảnh với Kaloclip trên video mẫu `7653105429953645844`.
> Output JSON dùng ĐÚNG field names như file `ground-truth/*.kalodata.json`.
>
> ⚠️ Đây KHÔNG phải prompt nguyên văn của Kaloclip (prompt của họ chạy server-side, không lấy được).
> Đây là bản tái dựng theo hành vi — chất lượng tương đương vì giá trị nằm ở taxonomy + format, không phải câu chữ.

Pipeline dùng 2 lần gọi model:
- **PROMPT 1 (Vision)**: mô tả từng keyframe → cỡ cảnh + mô tả hình.
- **PROMPT 2 (Chính)**: nhận transcript + mô tả hình → cắt đoạn + phân tích → JSON cuối.

---

## PROMPT 1 — VISION (mô tả keyframe)

Gửi kèm các ảnh keyframe, mỗi ảnh có 1 dòng `[t=<giây>s]` ngay trước nó.

```
Bạn là chuyên gia dựng phim quảng cáo TikTok. Dưới đây là các keyframe trích từ 1 video
bán hàng, mỗi ảnh kèm mốc thời gian (giây) ngay trước nó.

Với TỪNG ảnh, trả về một object:
- "t": mốc thời gian (giây) của ảnh (số).
- "co_canh": CHỌN ĐÚNG 1 trong 6 giá trị:
    Toàn Cảnh | Viễn Cảnh | Trung Cảnh | Trung Cận Cảnh | Cận Cảnh | Đặc Tả
- "mo_ta_hinh_anh": 1-2 câu tiếng Việt: ai/vật gì trong khung, đang làm gì, sản phẩm nào
  lộ rõ (đọc cả chữ trên bao bì nếu thấy), bố cục. CHỈ mô tả cái nhìn thấy, KHÔNG suy diễn lời thoại.

Trả về DUY NHẤT JSON: {"frames": [ {"t":..., "co_canh":"...", "mo_ta_hinh_anh":"..."}, ... ]}
```

---

## PROMPT 2 — CHÍNH (cắt đoạn + phân tích, ra JSON cuối)

Thay `{{transcript}}` = mảng JSON lời thoại `[{start,end,text}]`,
`{{frames}}` = mảng JSON output của Prompt 1.

```
Bạn là chuyên gia phân tích kịch bản video affiliate/bán hàng TikTok tiếng Việt.

INPUT:
- Lời thoại có timestamp (transcript):
{{transcript}}
- Mô tả hình ảnh theo mốc thời gian (frames):
{{frames}}

NHIỆM VỤ 1 — CẮT PHÂN CẢNH (kich_ban_video):
Cắt video thành các phân cảnh theo DÒNG CHẢY BÁN HÀNG. Giữ đúng thứ tự thời gian.
Mỗi phân cảnh là 1 object gồm 5 trường:
- "phan_canh": tên đoạn tiếng Việt NGẮN 2-4 từ, KHÔNG thêm phụ đề sau dấu ":".
  Dùng đúng bộ nhãn chuẩn dưới đây (khớp với chức năng của đoạn):
    Mở đầu Thu hút        (hook — câu mở gây chú ý / tuyên bố cực đoan)
    Điểm bán hàng Độc đáo (usp — điểm khác biệt/độc quyền, tease giá)
    Thông tin Sản phẩm    (thông số, dung tích, đối tượng dùng, neo giá)
    Trải nghiệm Thực tế   (cảm nhận mùi/chất/hiệu quả khi dùng)
    Hướng dẫn Sử dụng     (thao tác, cách dùng, demo tính năng)
    Kêu gọi Hành động     (chốt đơn cuối video)
  (Không bắt buộc đủ 6; bỏ đoạn nào video không có. Có thể lặp nếu video quay lại chủ đề.)
- "timestamp": chuỗi dạng "0~4s" (giây bắt đầu ~ giây kết thúc).
- "co_canh": gộp cỡ cảnh chủ đạo của đoạn từ frames (1 trong 6 giá trị ở Prompt 1).
- "mo_ta_hinh_anh": 1-2 câu gộp mô tả hình ảnh của đoạn.
- "kich_ban_am_thanh": gộp NGUYÊN VĂN lời thoại của đoạn.

QUY TẮC GÁN NHÃN (bám sát chuẩn — RẤT QUAN TRỌNG):
1. LUÔN tách "Kêu gọi Hành động" ở CUỐI video thành 1 phân cảnh riêng.
   TUYỆT ĐỐI không gộp chung với "Hướng dẫn Sử dụng".
2. Câu "ấn giỏ hàng / kiểm tra giá / săn đơn / giá hời" XEN GIỮA video là CHỐT-MỀM —
   vẫn thuộc đoạn nội dung đang nói (usp/thông tin/…), KHÔNG phải "Kêu gọi Hành động".
   Chỉ đoạn CUỐI cùng chốt mua mới là "Kêu gọi Hành động".
3. Neo giá / hô giá giảm dần ("500 không mua, 400 không mua…") = Thông tin Sản phẩm hoặc
   Điểm bán hàng Độc đáo, KHÔNG phải kêu gọi hành động.

NHIỆM VỤ 2 — PHÂN TÍCH (giai_thich_diem_thanh_cong):
- "points": 4-6 câu, MỖI câu nêu 1 ĐÒN BẨY tâm lý bán hàng và cách video này dùng nó.
  Bám các trục: (a) khơi tò mò, (b) hiệu quả kinh tế/giá trị, (c) tính năng độc đáo giải
  quyết nỗi đau, (d) tạo niềm tin (an toàn, chứng cứ), (e) khan hiếm + ưu đãi thúc mua ngay.
- "ky_thuat_quay_phim": 1 đoạn phân tích cỡ cảnh chủ đạo, chuyển động máy (nghiêng/xoay/zoom),
  cách đặt sản phẩm trong khung, và tác dụng lên người xem.

CHỈ trả về JSON đúng cấu trúc sau, không thêm chữ nào ngoài JSON:
{
  "kich_ban_video": [
    {"phan_canh":"", "timestamp":"", "co_canh":"", "mo_ta_hinh_anh":"", "kich_ban_am_thanh":""}
  ],
  "giai_thich_diem_thanh_cong": {
    "points": [""],
    "ky_thuat_quay_phim": ""
  }
}
```

---

## JSON Schema (dùng cho structured output — ép model trả đúng cấu trúc)

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["kich_ban_video", "giai_thich_diem_thanh_cong"],
  "properties": {
    "kich_ban_video": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["phan_canh", "timestamp", "co_canh", "mo_ta_hinh_anh", "kich_ban_am_thanh"],
        "properties": {
          "phan_canh": {"type": "string"},
          "timestamp": {"type": "string"},
          "co_canh": {"type": "string", "enum": ["Toàn Cảnh","Viễn Cảnh","Trung Cảnh","Trung Cận Cảnh","Cận Cảnh","Đặc Tả"]},
          "mo_ta_hinh_anh": {"type": "string"},
          "kich_ban_am_thanh": {"type": "string"}
        }
      }
    },
    "giai_thich_diem_thanh_cong": {
      "type": "object",
      "additionalProperties": false,
      "required": ["points", "ky_thuat_quay_phim"],
      "properties": {
        "points": {"type": "array", "items": {"type": "string"}},
        "ky_thuat_quay_phim": {"type": "string"}
      }
    }
  }
}
```

---

## Gọi API mẫu (Python, Claude)

```python
import anthropic, json
client = anthropic.Anthropic()

resp = client.messages.create(
    model="claude-opus-5",          # hoặc claude-sonnet-5 cho rẻ hơn
    max_tokens=8000,
    output_config={"format": {"type": "json_schema", "schema": SCHEMA}},  # schema ở trên
    messages=[{"role": "user", "content": PROMPT_2}],  # đã thay {{transcript}} {{frames}}
)
data = json.loads(next(b.text for b in resp.content if b.type == "text"))
```

## Ghi chú vận hành
- Nhiệm vụ 1 (cắt) và 2 (phân tích) có thể gộp 1 lần gọi như trên, hoặc tách 2 lần nếu muốn kiểm soát riêng.
- Nếu chạy video khác mà nhãn bị lệch → tinh chỉnh phần "QUY TẮC GÁN NHÃN" (đây là chỗ quyết định độ khớp với Kaloclip).
- File này đồng bộ với `storyboard/prompts.py` trong MVP; sửa 1 chỗ thì cập nhật chỗ kia.
```
