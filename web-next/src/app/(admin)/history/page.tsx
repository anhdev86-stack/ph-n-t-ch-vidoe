"use client";

import React, { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Popconfirm, Tag, Space } from "antd";
import { PlayCircleOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { api } from "../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Hist { video_id: string; source: string; title: string; analyzed_at: number }

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<Hist[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/history").then((r) => setItems(r.history || [])).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (id: string) => { await api.delete(`/history/${id}`); load(); };
  const view = (h: Hist) => router.push(`/?video_id=${h.video_id}&source=${h.source}&title=${encodeURIComponent(h.title || "")}`);

  const columns = [
    { title: "Video", dataIndex: "video_id", width: 110,
      render: (id: string) => (
        <video src={`${API_URL}/analyze/${id}/video`} muted
          style={{ width: 80, height: 108, objectFit: "cover", borderRadius: 8, background: "#000", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
          onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          onClick={() => view({ video_id: id } as Hist)} />
      ) },
    { title: "Tiêu đề / Tên", dataIndex: "title", ellipsis: true },
    { title: "Phân tích lúc", dataIndex: "analyzed_at", width: 170,
      render: (t: number) => dayjs.unix(t).format("DD/MM/YYYY HH:mm") },
    { title: "", width: 210, render: (_: unknown, h: Hist) => (
      <Space>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => view(h)}>Xem lại</Button>
        <Popconfirm title="Xoá khỏi lịch sử?" okText="Xoá" cancelText="Huỷ" onConfirm={() => remove(h.video_id)}>
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) },
  ];

  const tableFor = (source: string) => (
    <Table rowKey="video_id" columns={columns} loading={loading}
      dataSource={items.filter((x) => x.source === source)}
      pagination={{ pageSize: 10 }}
      locale={{ emptyText: source === "upload" ? "Chưa phân tích video đối thủ nào." : "Chưa phân tích video affiliate nào." }} />
  );

  return (
    <Card title="Lịch sử phân tích"
      extra={<Button icon={<ReloadOutlined />} onClick={load}>Tải lại</Button>}>
      <Tabs
        items={[
          { key: "tiktok", label: <>Video Affiliate <Tag color="gold">{items.filter((x) => x.source === "tiktok").length}</Tag></>, children: tableFor("tiktok") },
          { key: "upload", label: <>Video đối thủ <Tag color="blue">{items.filter((x) => x.source === "upload").length}</Tag></>, children: tableFor("upload") },
        ]}
      />
    </Card>
  );
}
