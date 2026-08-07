"use client";

import React, { useState } from "react";
import { Button, Modal, Spin, Typography, message } from "antd";
import { BulbOutlined } from "@ant-design/icons";
import { api } from "../lib/api";

const { Title, Paragraph, Text } = Typography;

export interface CommonItem {
  video_id: string;
  source: string;
  video_url?: string;
  title?: string;
}
interface Common {
  diem_chung?: string[];
  cau_truc_chung?: string;
  hook_chung?: string;
  thong_diep_chung?: string;
  ky_thuat_quay_chung?: string;
  goi_y?: string;
}

export default function CommonAnalyze({ items }: { items: CommonItem[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [common, setCommon] = useState<Common | null>(null);
  const [count, setCount] = useState(0);
  const [err, setErr] = useState("");
  const [msg, ctx] = message.useMessage();

  const run = async () => {
    if (items.length < 2) { msg.warning("Chọn ít nhất 2 video."); return; }
    setOpen(true); setLoading(true); setErr(""); setCommon(null);
    try {
      const r = await api.post("/analyze-common", { videos: items });
      if (r.error) setErr(r.error);
      else { setCommon(r.common); setCount(r.count); }
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  };

  return (
    <>
      {ctx}
      <Button type="primary" icon={<BulbOutlined />} disabled={items.length < 2} onClick={run}>
        Tìm điểm chung{items.length ? ` (${items.length})` : ""}
      </Button>
      <Modal open={open} onCancel={() => setOpen(false)} footer={null} width={720}
        title={common ? `Điểm chung của ${count} video` : "Tìm điểm chung"}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 14, color: "#888" }}>
              AI đang phân tích điểm chung… video nào chưa phân tích sẽ được xử lý trước (có thể mất vài phút).
            </div>
          </div>
        ) : err ? (
          <Text type="danger">{err}</Text>
        ) : common ? (
          <div>
            <Title level={5}>✨ Điểm chung nổi bật</Title>
            <ol style={{ lineHeight: 1.8 }}>
              {(common.diem_chung || []).map((p, i) => <li key={i}>{p}</li>)}
            </ol>
            <Paragraph><b>🧱 Cấu trúc chung:</b> {common.cau_truc_chung}</Paragraph>
            <Paragraph><b>🎣 Hook chung:</b> {common.hook_chung}</Paragraph>
            <Paragraph><b>💬 Thông điệp chung:</b> {common.thong_diep_chung}</Paragraph>
            <Paragraph><b>🎬 Kỹ thuật quay chung:</b> {common.ky_thuat_quay_chung}</Paragraph>
            <Paragraph style={{ background: "#fffbe6", padding: 12, borderRadius: 8 }}>
              <b>💡 Gợi ý áp dụng:</b> {common.goi_y}
            </Paragraph>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
