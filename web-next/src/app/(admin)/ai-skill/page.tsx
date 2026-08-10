"use client";

import React, { useEffect, useState } from "react";
import { Card, Input, Button, Typography, message, Result, Space, Alert } from "antd";
import { BulbOutlined, SaveOutlined } from "@ant-design/icons";
import { useSession } from "next-auth/react";
import { api } from "../../../lib/api";

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

interface Skill { kien_thuc: string; tong_giong: string; quy_tac: string; phan_tich_huong_dan: string }

export default function AiSkillPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [skill, setSkill] = useState<Skill>({ kien_thuc: "", tong_giong: "", quy_tac: "", phan_tich_huong_dan: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, ctx] = message.useMessage();

  useEffect(() => {
    api.get("/ai-skill")
      .then((r) => setSkill({ kien_thuc: r.kien_thuc || "", tong_giong: r.tong_giong || "", quy_tac: r.quy_tac || "", phan_tich_huong_dan: r.phan_tich_huong_dan || "" }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/ai-skill", { ...skill });
      msg.success("Đã lưu. Trợ lý AI sẽ dùng tri thức này cho các lần phân tích tiếp theo.");
    } catch (e) { msg.error(String((e as Error).message || e)); }
    finally { setSaving(false); }
  };

  if (status === "authenticated" && !isAdmin) {
    return <Result status="403" title="Không có quyền"
      subTitle="Chỉ admin mới được huấn luyện AI cho toàn hệ thống." />;
  }

  const field = (label: string, hint: string, key: keyof Skill, rows: number, placeholder: string) => (
    <div>
      <Text strong>{label}</Text>
      <Paragraph type="secondary" style={{ margin: "2px 0 6px", fontSize: 13 }}>{hint}</Paragraph>
      <TextArea rows={rows} value={skill[key]} placeholder={placeholder}
        onChange={(e) => setSkill((s) => ({ ...s, [key]: e.target.value }))} />
    </div>
  );

  return (
    <Card title={<span><BulbOutlined style={{ color: "#B8912F" }} /> Huấn luyện AI (tri thức riêng của shop)</span>}
      loading={loading}
      extra={<Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}
        style={{ background: "#B8912F", borderColor: "#B8912F" }}>Lưu</Button>}>
      {ctx}
      <Alert type="info" showIcon style={{ marginBottom: 20 }}
        message="Dạy AI hiểu ngành hàng & phong cách của shop"
        description="Nội dung ở đây được tự động chèn vào AI cho cả 'Phân tích video (Storyboard) + Giải thích điểm thành công' VÀ 'Rút công thức content'. Không phải train model — áp dụng ngay cho các video phân tích MỚI. Để trống = giữ nguyên như mặc định hiện tại." />
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        {field("1. Kiến thức ngành / sản phẩm / khách hàng",
          "Sản phẩm chủ lực, USP, đối tượng khách, nỗi đau chính, thuật ngữ ngành…",
          "kien_thuc", 6,
          "VD: Shop bán mỹ phẩm tẩy lông Ollie. USP: an toàn cho da nhạy cảm, không rát. Khách nữ 18-30, ngại lông tay/chân. Đối thủ hay dùng before/after…")}
        {field("2. Tông giọng & phong cách thương hiệu",
          "Cách xưng hô, giọng điệu, phong cách nội dung mong muốn.",
          "tong_giong", 4,
          "VD: Xưng 'mình' - gọi 'các nàng'. Vui tươi, gần gũi, thật, không sến. Ưu tiên kể trải nghiệm cá nhân hơn quảng cáo khô khan.")}
        {field("3. Quy tắc NÊN / KHÔNG NÊN",
          "Điều bắt buộc làm và điều cấm (từ ngữ cấm, claim không được nói…).",
          "quy_tac", 4,
          "VD: KHÔNG dùng từ 'chữa khỏi', 'trắng cấp tốc'. NÊN có hook 3 giây đầu + bằng chứng số liệu. Luôn nhắc mã giảm giá ở cuối.")}
        {field("4. Hướng dẫn riêng cho phần PHÂN TÍCH VIDEO & điểm thành công (tùy chọn)",
          "Chỉ dẫn thêm để AI phân tích storyboard & giải thích điểm thành công theo ý bạn. Để trống = phân tích như mặc định.",
          "phan_tich_huong_dan", 5,
          "VD: Nhấn mạnh phân tích HOOK 3 giây đầu. Giải thích điểm thành công theo góc nhìn tâm lý mua hàng của phụ nữ 18-30. Chỉ rõ khoảnh khắc chốt đơn.")}
      </Space>
    </Card>
  );
}
