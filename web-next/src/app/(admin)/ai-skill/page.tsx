"use client";

import React, { useEffect, useState } from "react";
import { Card, Input, Button, Typography, message, Result, Space, Alert, Upload, List, Popconfirm, Tag, Divider } from "antd";
import type { UploadProps } from "antd";
import { BulbOutlined, SaveOutlined, InboxOutlined, FileTextOutlined, DeleteOutlined, PlayCircleOutlined, RocketOutlined } from "@ant-design/icons";
import { useSession } from "next-auth/react";
import { useAuth } from "../../../lib/auth";
import { api } from "../../../lib/api";

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Doc { id: string; name: string; chars: number; uploaded_at: number }
type Scope = "analysis" | "insights";

export default function AiSkillPage() {
  const { data: session, status } = useSession();
  const { accessToken } = useAuth();
  const isAdmin = session?.user?.role === "admin";
  const [note, setNote] = useState<Record<Scope, string>>({ analysis: "", insights: "" });
  const [docs, setDocs] = useState<Record<Scope, Doc[]>>({ analysis: [], insights: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, ctx] = message.useMessage();

  const load = () => {
    api.get("/ai-skill").then((r) => {
      setNote({ analysis: r.analysis?.note || "", insights: r.insights?.note || "" });
      setDocs({ analysis: r.analysis?.documents || [], insights: r.insights?.documents || [] });
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/ai-skill", { analysis_note: note.analysis, insights_note: note.insights });
      msg.success("Đã lưu. AI sẽ dùng tri thức này cho các lần chạy tiếp theo.");
    } catch (e) { msg.error(String((e as Error).message || e)); }
    finally { setSaving(false); }
  };

  const draggerProps = (scope: Scope): UploadProps => ({
    name: "file", multiple: true, accept: ".md,.txt,.pdf,.markdown", showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      const fd = new FormData(); fd.append("file", file as File);
      try {
        const res = await fetch(`${API_URL}/ai-skill/docs?scope=${scope}`, {
          method: "POST", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, body: fd,
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Lỗi tải lên");
        onSuccess?.(j); msg.success(`Đã nạp: ${(file as File).name}`); load();
      } catch (e) { onError?.(e as Error); msg.error(String((e as Error).message || e)); }
    },
  });

  const removeDoc = async (id: string) => { await api.delete(`/ai-skill/docs/${id}`); msg.success("Đã xoá tài liệu"); load(); };

  if (status === "authenticated" && !isAdmin) {
    return <Result status="403" title="Không có quyền"
      subTitle="Chỉ admin mới được huấn luyện AI cho toàn hệ thống." />;
  }

  const block = (scope: Scope, icon: React.ReactNode, title: string, desc: string, placeholder: string) => (
    <div>
      <Title level={5} style={{ marginBottom: 2 }}>{icon} {title}</Title>
      <Paragraph type="secondary" style={{ margin: "0 0 10px", fontSize: 13 }}>{desc}</Paragraph>

      <Text strong style={{ fontSize: 13 }}>📎 Tài liệu (.md / .txt / .pdf)</Text>
      <Dragger {...draggerProps(scope)} style={{ padding: 6, marginTop: 6 }}>
        <p className="ant-upload-drag-icon" style={{ margin: 0 }}><InboxOutlined /></p>
        <p className="ant-upload-text" style={{ fontSize: 13 }}>Kéo-thả hoặc bấm để tải tài liệu</p>
      </Dragger>
      {docs[scope].length > 0 && (
        <List size="small" style={{ marginTop: 10 }} bordered dataSource={docs[scope]}
          renderItem={(d) => (
            <List.Item actions={[
              <Popconfirm key="d" title="Xoá tài liệu này?" okText="Xoá" cancelText="Huỷ" onConfirm={() => removeDoc(d.id)}>
                <Button danger type="text" size="small" icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}>
              <Space><FileTextOutlined style={{ color: "#B8912F" }} /> {d.name}
                <Tag>{(d.chars || 0).toLocaleString("vi-VN")} ký tự</Tag></Space>
            </List.Item>
          )} />
      )}

      <Text strong style={{ fontSize: 13, display: "block", marginTop: 14 }}>✍️ Ghi chú / hướng dẫn nhanh (tùy chọn)</Text>
      <TextArea rows={4} style={{ marginTop: 6 }} value={note[scope]} placeholder={placeholder}
        onChange={(e) => setNote((n) => ({ ...n, [scope]: e.target.value }))} />
    </div>
  );

  return (
    <Card title={<span><BulbOutlined style={{ color: "#B8912F" }} /> Huấn luyện AI (tri thức riêng của shop)</span>}
      loading={loading}
      extra={<Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}
        style={{ background: "#B8912F", borderColor: "#B8912F" }}>Lưu ghi chú</Button>}>
      {ctx}
      <Alert type="info" showIcon style={{ marginBottom: 20 }}
        message="2 khối huấn luyện riêng biệt"
        description="Mỗi khối chỉ áp cho đúng chức năng của nó. Tài liệu upload có hiệu lực NGAY (không cần bấm Lưu); ghi chú thì bấm 'Lưu ghi chú'. Để trống = giữ nguyên như mặc định." />

      {block("analysis", <PlayCircleOutlined style={{ color: "#B8912F" }} />,
        "Khối 1 — Phân tích video & Điểm thành công",
        "Dạy AI cách bóc storyboard & giải thích điểm thành công theo ý shop. Áp cho video phân tích MỚI.",
        "VD: Nhấn mạnh phân tích HOOK 3 giây đầu. Giải thích điểm thành công theo tâm lý mua của nữ 18-30. Chỉ rõ khoảnh khắc chốt đơn.")}

      <Divider />

      {block("insights", <RocketOutlined style={{ color: "#B8912F" }} />,
        "Khối 2 — Đúc rút công thức content",
        "Dạy AI cách rút 'công thức thắng' khi bấm nút 'Rút công thức content (AI)' ở tab Video Affiliate.",
        "VD: Ưu tiên gợi ý hook & sản phẩm theo ngành mỹ phẩm. Tránh khuyến nghị chung chung. Luôn kèm bằng chứng số liệu.")}
    </Card>
  );
}
