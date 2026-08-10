"use client";

import React, { useEffect, useState } from "react";
import { Card, Input, Button, Typography, message, Result, Space, Alert, Upload, List, Popconfirm, Tag } from "antd";
import type { UploadProps } from "antd";
import { BulbOutlined, SaveOutlined, InboxOutlined, FileTextOutlined, DeleteOutlined } from "@ant-design/icons";
import { useSession } from "next-auth/react";
import { useAuth } from "../../../lib/auth";
import { api } from "../../../lib/api";

const { Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Skill { kien_thuc: string; tong_giong: string; quy_tac: string; phan_tich_huong_dan: string }
interface Doc { id: string; name: string; chars: number; uploaded_at: number }

export default function AiSkillPage() {
  const { data: session, status } = useSession();
  const { accessToken } = useAuth();
  const isAdmin = session?.user?.role === "admin";
  const [skill, setSkill] = useState<Skill>({ kien_thuc: "", tong_giong: "", quy_tac: "", phan_tich_huong_dan: "" });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, ctx] = message.useMessage();

  const loadDocs = () => { api.get("/ai-skill/docs").then((r) => setDocs(r.documents || [])).catch(() => {}); };
  useEffect(() => {
    api.get("/ai-skill")
      .then((r) => setSkill({ kien_thuc: r.kien_thuc || "", tong_giong: r.tong_giong || "", quy_tac: r.quy_tac || "", phan_tich_huong_dan: r.phan_tich_huong_dan || "" }))
      .catch(() => {})
      .finally(() => setLoading(false));
    loadDocs();
  }, []);

  const draggerProps: UploadProps = {
    name: "file", multiple: true, accept: ".md,.txt,.pdf,.markdown", showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      const fd = new FormData(); fd.append("file", file as File);
      try {
        const res = await fetch(`${API_URL}/ai-skill/docs`, {
          method: "POST", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, body: fd,
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Lỗi tải lên");
        onSuccess?.(j); msg.success(`Đã nạp: ${(file as File).name}`); loadDocs();
      } catch (e) { onError?.(e as Error); msg.error(String((e as Error).message || e)); }
    },
  };

  const removeDoc = async (id: string) => { await api.delete(`/ai-skill/docs/${id}`); msg.success("Đã xoá tài liệu"); loadDocs(); };

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
      <div style={{ marginBottom: 24 }}>
        <Text strong>📎 Tài liệu huấn luyện (khuyên dùng)</Text>
        <Paragraph type="secondary" style={{ margin: "2px 0 8px", fontSize: 13 }}>
          Tải lên tài liệu <b>.md / .txt / .pdf</b> (cẩm nang bán hàng, brief thương hiệu, tài liệu sản phẩm…).
          Server tự bóc nội dung và nạp vào AI cho cả phân tích video & rút công thức.
        </Paragraph>
        <Dragger {...draggerProps} style={{ padding: 8 }}>
          <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}><InboxOutlined /></p>
          <p className="ant-upload-text">Kéo-thả hoặc bấm để tải tài liệu (.md .txt .pdf)</p>
        </Dragger>
        {docs.length > 0 && (
          <List size="small" style={{ marginTop: 12 }} bordered dataSource={docs}
            renderItem={(d) => (
              <List.Item actions={[
                <Popconfirm key="del" title="Xoá tài liệu này?" okText="Xoá" cancelText="Huỷ" onConfirm={() => removeDoc(d.id)}>
                  <Button danger type="text" size="small" icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}>
                <Space><FileTextOutlined style={{ color: "#B8912F" }} /> {d.name}
                  <Tag>{(d.chars || 0).toLocaleString("vi-VN")} ký tự</Tag></Space>
              </List.Item>
            )} />
        )}
      </div>

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
