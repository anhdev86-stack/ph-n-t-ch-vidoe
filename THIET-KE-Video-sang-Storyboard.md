# Thiết kế: Feature "Video sang Storyboard" (reverse-engineer từ Kaloclip)

> Tài liệu kỹ thuật để tự xây lại tính năng phân tích video TikTok thành storyboard.
> Nguồn: nghiên cứu trực tiếp Kaloclip (clip.kalowave.com) — đọc pipeline loading + output 2 tab.

---

## 0. TL;DR

Kaloclip biến 1 video bán hàng thành:
- **Bảng storyboard 3 cột**: Phân cảnh (tên + timestamp) | Mô tả hình ảnh (cỡ cảnh + mô tả) | Kịch bản âm thanh (transcript).
- **Bản phân tích "điểm thành công"**: 5 điểm tâm lý marketing + phân tích kỹ thuật quay phim.

Model không đặc biệt. **Giá trị nằm ở 3 bộ khung (taxonomy) nhét vào prompt** + cache kết quả.

---

## 1. Pipeline thật của Kaloclip (bắt được ở màn hình loading)

Thứ tự 8 bước họ hiển thị khi xử lý:

1. **Trích xuất video** — tải video, tách frames + audio.
2. **Phân loại video** — nhận diện loại video (review / bán hàng / unboxing…).
3. **Phân tích hình ảnh** — vision model xem keyframes.
4. **Phân tích âm thanh** — tách giọng khỏi nhạc nền.
5. **Nhận diện ngôn ngữ** — detect tiếng Việt → chọn model ASR.
6. **Phân tích cấu trúc kịch bản** — LLM gom transcript thành phân đoạn marketing.
7. **Khớp đặc điểm dữ liệu** — đồng bộ timestamp giữa hình ảnh ↔ lời thoại ↔ phân đoạn.
8. **Tạo kết quả cuối cùng** — render bảng + sinh phần phân tích.

---

## 2. Ba bộ khung "nạp" vào prompt (bí quyết cốt lõi)

### 2.1. Khung 6 giai đoạn kịch bản affiliate (đặt tên phân đoạn)
Quan sát output thực tế:
```
Mở đầu Thu hút (Hook)       → 0~4s
Điểm bán hàng Độc đáo (USP) → 4~15s
Thông tin Sản phẩm          → 15~25s
Trải nghiệm Thực tế         → 25~42s
Hướng dẫn Sử dụng           → 42~57s
Kêu gọi Hành động (CTA)     → 57~end
```
LLM buộc phải map mọi video về các nhãn chức năng này (số đoạn linh hoạt, nhưng luôn theo dòng Hook→...→CTA).

### 2.2. Taxonomy cỡ cảnh (shot type) — danh sách đóng
```
Toàn cảnh (Wide/Establishing)
Viễn cảnh (Extreme Wide)
Trung cảnh (Medium)
Trung cận cảnh (Medium Close-Up)
Cận cảnh (Close-Up)
Đặc tả (Extreme Close-Up / Detail)
```
Vision model chỉ được chọn trong danh sách này → output nhất quán.

### 2.3. Khung tâm lý bán hàng (sinh tab "điểm thành công")
```
1. Khơi gợi tò mò (curiosity hook)
2. Nhấn giá trị / hiệu quả kinh tế (value)
3. Tính năng độc đáo / giải quyết nỗi đau (USP / pain-solving)
4. Tạo niềm tin (trust: an toàn, chứng cứ)
5. Khan hiếm + ưu đãi sốc → thúc CTA (scarcity + urgency)
```
Kèm 1 khối phân tích **kỹ thuật quay phim** (cỡ cảnh chủ đạo, chuyển động máy, bố cục sản phẩm).

---

## 3. Stack đề xuất (khuyến nghị: LAI / HYBRID)

Có 2 triết lý. Kaloclip đi theo cách "8 bước rời". Nhưng model 2026 cho phép **gộp mạnh** → rẻ và nhanh hơn nhiều.

### Phương án A — Gemini native video (KHUYẾN NGHỊ để bắt đầu)
- **Gemini Flash** ingest thẳng file video (cả hình + tiếng) → trả về **1 JSON structured** chứa cả transcript-có-timestamp, mô tả hình ảnh, cỡ cảnh, phân đoạn. Gộp bước 1–7 thành **1 call**.
- Thêm **1 call LLM** nữa (Gemini/Claude) để sinh phần "điểm thành công".
- Ưu: ít hạ tầng, không GPU, làm được MVP trong 1 ngày. Nhược: ASR tiếng Việt đôi khi sai từ địa phương.

### Phương án B — Tự host (chuẩn Kaloclip, chính xác nhất)
- **ASR**: Whisper large-v3 hoặc **PhoWhisper** (tối ưu tiếng Việt) → transcript + timestamp cấp từ.
- **Keyframe**: `ffmpeg` scene-detect (`select='gt(scene,0.3)'`) → lấy frame đại diện mỗi cảnh.
- **Vision**: Claude/Gemini vision mô tả từng keyframe + gán cỡ cảnh.
- **Segmentation + phân tích**: LLM (Claude) gom đoạn theo 3 khung ở mục 2.
- Ưu: chính xác tiếng Việt cao nhất, rẻ dài hạn. Nhược: cần GPU cho Whisper, nhiều bước.

### 👉 Khuyến nghị thực tế: **LAI**
> **PhoWhisper/Whisper (tự host, ASR tiếng Việt)** + **Gemini/Claude vision cho keyframe** + **Claude cho segmentation & phân tích tâm lý**.
>
> Lý do: ASR là chỗ dễ sai nhất với tiếng Việt bán hàng (nói nhanh, từ lóng) → tự host để chuẩn. Còn hiểu hình ảnh + suy luận marketing thì API mạnh hơn và không đáng để tự host.

Bắt đầu bằng **Phương án A** để có MVP, rồi thay dần khối ASR bằng PhoWhisper khi cần độ chính xác.

---

## 4. Kiến trúc & luồng dữ liệu

```
[Video URL/file]
      │
      ▼
┌─────────────────┐   ffmpeg
│ 1. Ingest       │──────────► audio.wav + frames/*.jpg (theo scene-change)
└─────────────────┘
      │
      ├──────────────► [ASR: PhoWhisper] ──► transcript[] {start,end,text}
      │
      └──────────────► [Vision: mỗi keyframe] ──► visual[] {t, shot_type, desc}
      │
      ▼
┌─────────────────────────────┐
│ 2. Align + Segment (LLM)    │  gộp transcript+visual, cắt đoạn theo khung 6 giai đoạn
└─────────────────────────────┘
      │
      ▼
   storyboard[] {section_name, start, end, shot_type, visual_desc, transcript}
      │
      ├──► render Bảng (Tab A)
      └──► [LLM] sinh "điểm thành công" + "kỹ thuật quay phim" (Tab B)
      │
      ▼
   Lưu DB (cache theo video_id) — mở lại đọc cache, KHÔNG chạy lại
```

**Ghi chú caching**: Kaloclip cache toàn bộ theo `video_id`. Mở lại trang chỉ gọi `/api/log`, không sinh lại. Anh nên làm y hệt: key = hash(video_id) → lưu JSON storyboard vào DB/S3.

---

## 5. Data model (JSON schema)

```json
{
  "video_id": "7653105429953645844",
  "duration_sec": 68,
  "language": "vi",
  "storyboard": [
    {
      "section_name": "Mở đầu Thu hút",
      "section_type": "hook",
      "start": 0,
      "end": 4,
      "shot_type": "Trung Cảnh",
      "visual_desc": "Người phụ nữ trẻ khiêng thùng nước giặt lớn in chữ...",
      "transcript": "Cái này nó lưu hương đến cả một tuần cơ..."
    }
  ],
  "success_analysis": {
    "points": [
      "Khơi gợi tò mò bằng hình ảnh thùng hàng lớn...",
      "Nhấn hiệu quả kinh tế & độ bền hương thơm..."
    ],
    "filming_technique": "Chủ yếu close-up và medium close-up, zoom vào nhãn/vòi..."
  }
}
```

`section_type` chuẩn hoá (enum): `hook | usp | product_info | experience | how_to | social_proof | cta`.

---

## 6. Prompt mẫu (copy-paste, chỉnh nhẹ)

### 6.1. Prompt Vision — mô tả keyframe + gán cỡ cảnh
```
Bạn là chuyên gia dựng phim quảng cáo. Xem khung hình này.
Trả về JSON:
{
  "shot_type": "<chọn ĐÚNG 1 trong: Toàn cảnh | Viễn cảnh | Trung cảnh |
                 Trung cận cảnh | Cận cảnh | Đặc tả>",
  "visual_desc": "<1-2 câu tiếng Việt: ai/vật gì, đang làm gì, bố cục, sản phẩm nào lộ rõ>"
}
Chỉ mô tả cái NHÌN THẤY, không suy diễn lời thoại.
```

### 6.2. Prompt Segmentation — cắt đoạn theo khung marketing
```
Bạn là chuyên gia kịch bản video affiliate TikTok.
INPUT:
- transcript (có timestamp): {{transcript_json}}
- mô tả hình ảnh theo mốc thời gian: {{visual_json}}

NHIỆM VỤ: Cắt video thành các PHÂN ĐOẠN theo dòng chảy bán hàng.
Mỗi đoạn gán 1 section_type trong: hook, usp, product_info, experience,
how_to, social_proof, cta (KHÔNG bắt buộc đủ hết, KHÔNG lặp sai thứ tự tự nhiên).
Đặt section_name tiếng Việt hấp dẫn (vd "Mở đầu Thu hút", "Điểm bán hàng Độc đáo").

Trả về JSON mảng storyboard đúng schema:
[{section_name, section_type, start, end, shot_type, visual_desc, transcript}]
Gộp shot_type & visual_desc từ các keyframe rơi vào khoảng [start,end].
```

### 6.3. Prompt Success Analysis — sinh tab "điểm thành công"
```
Dựa trên storyboard sau: {{storyboard_json}}
Viết bằng tiếng Việt:

1. "Giải thích điểm thành công": 4-6 gạch đầu dòng, mỗi dòng chỉ ra 1 ĐÒN BẨY TÂM LÝ
   bán hàng và cách video này dùng nó. Bám các trục: tò mò, giá trị/kinh tế,
   USP giải quyết nỗi đau, tạo niềm tin, khan hiếm+ưu đãi thúc CTA.

2. "Kỹ thuật quay phim": 1 đoạn phân tích cỡ cảnh chủ đạo, chuyển động máy,
   cách zoom vào chi tiết, bố cục đặt sản phẩm.
```

---

## 7. Ước tính chi phí (tham khảo)

| Khối | Phương án A (API) | Phương án Lai |
|---|---|---|
| ASR | trong call video | PhoWhisper self-host (~0đ/video, tốn GPU) |
| Vision | ~5-15 keyframe/video | ~5-15 keyframe/video |
| Segment + phân tích | 2 call LLM | 2 call LLM |
| **Mỗi video** | ~vài cent (Flash) | rẻ hơn nếu volume lớn |

Cache = tiết kiệm lớn nhất: mỗi video chỉ xử lý 1 lần.

---

## 8. Roadmap gợi ý

1. **MVP (1-2 ngày)**: Phương án A — Gemini native video → JSON → render bảng. Chưa cần tab B.
2. **v1**: thêm tab "điểm thành công", chuẩn hoá enum section_type, cache DB.
3. **v2**: thay ASR bằng PhoWhisper để chuẩn tiếng Việt; thêm scene-detect ffmpeg cho cỡ cảnh chính xác.
4. **v3**: nút "Xuất kịch bản", "Tối ưu kịch bản" (LLM viết lại kịch bản hay hơn) — giống Kaloclip.
