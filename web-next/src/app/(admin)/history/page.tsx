"use client";

import React, { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Popconfirm, Tag, Space, Modal, Select, Typography, message } from "antd";
import { PlayCircleOutlined, DeleteOutlined, ReloadOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dayjs from "dayjs";
import { api } from "../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const { Text } = Typography;

interface Hist { video_id: string; source: string; title: string; analyzed_at: number; owner?: string }

export default function HistoryPage() {
  const router = useRouter();
  const isAdmin = useSession().data?.user?.role === "admin";
  const [items, setItems] = useState<Hist[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<string[]>([]);
  const [reassign, setReassign] = useState<Hist | null>(null);
  const [newOwner, setNewOwner] = useState<string>();
  const [msg, ctx] = message.useMessage();

  const load = () => {
    setLoading(true);
    api.get("/history").then((r) => setItems(r.history || [])).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => { if (isAdmin) api.get("/users").then((r) => setUsers((r.users || r || []).map((u: { username: string }) => u.username))).catch(() => {}); }, [isAdmin]);

  const doReassign = async () => {
    if (!reassign || !newOwner) return;
    await api.put(`/history/${reassign.video_id}/owner`, { owner: newOwner, from_owner: reassign.owner || "admin" });
    msg.success(`Đã chuyển sang: ${newOwner}`);
    setReassign(null); setNewOwner(undefined); load();
  };

  const remove = async (h: Hist) => {
    const q = isAdmin && h.owner ? `?owner=${encodeURIComponent(h.owner)}` : "";
    await api.delete(`/history/${h.video_id}${q}`);
    load();
  };
  const view = (h: Hist) => router.push(`/?video_id=${h.video_id}&source=${h.source}&title=${encodeURIComponent(h.title || "")}`);

  const owners = [...new Set(items.map((x) => x.owner || "admin"))];

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
    // Cột "Người dùng" chỉ hiện cho admin — lọc được theo từng nhân viên.
    ...(isAdmin ? [{
      title: "Người dùng", dataIndex: "owner", width: 150,
      filters: owners.map((o) => ({ text: o, value: o })),
      onFilter: (v: React.Key | boolean, r: Hist) => (r.owner || "admin") === v,
      render: (o: string) => <Tag color="geekblue">{o || "admin"}</Tag>,
    }] : []),
    { title: "Phân tích lúc", dataIndex: "analyzed_at", width: 170,
      render: (t: number) => dayjs.unix(t).format("DD/MM/YYYY HH:mm") },
    { title: "", width: 300, render: (_: unknown, h: Hist) => (
      <Space>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => view(h)}>Xem lại</Button>
        {isAdmin && (
          <Button icon={<UserSwitchOutlined />} onClick={() => { setReassign(h); setNewOwner(h.owner || "admin"); }}
            title="Đổi người sở hữu">Đổi người dùng</Button>
        )}
        <Popconfirm title="Xoá khỏi lịch sử?" okText="Xoá" cancelText="Huỷ" onConfirm={() => remove(h)}>
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) },
  ];

  const tableFor = (source: string) => (
    <Table rowKey={(r) => `${r.video_id}_${r.owner || ""}`} columns={columns} loading={loading} size="small"
      dataSource={items.filter((x) => x.source === source)}
      sticky scroll={{ x: "max-content", y: 560 }}
      pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: (t) => `${t} video` }}
      locale={{ emptyText: source === "upload" ? "Chưa phân tích video đối thủ nào." : "Chưa phân tích video affiliate nào." }} />
  );

  return (
    <Card title={isAdmin ? "Lịch sử phân tích (toàn bộ nhân viên)" : "Lịch sử phân tích"}
      extra={<Button icon={<ReloadOutlined />} onClick={load}>Tải lại</Button>}>
      {ctx}
      <Tabs
        items={[
          { key: "tiktok", label: <>Video Affiliate <Tag color="gold">{items.filter((x) => x.source === "tiktok").length}</Tag></>, children: tableFor("tiktok") },
          { key: "upload", label: <>Video đối thủ <Tag color="blue">{items.filter((x) => x.source === "upload").length}</Tag></>, children: tableFor("upload") },
        ]}
      />

      <Modal open={!!reassign} onCancel={() => setReassign(null)} onOk={doReassign}
        okText="Chuyển" cancelText="Huỷ" title="Đổi người sở hữu lịch sử"
        okButtonProps={{ disabled: !newOwner }}>
        <Text type="secondary">Video: <b>{reassign?.title}</b></Text>
        <div style={{ marginTop: 12 }}>
          <Text>Gán cho tài khoản:</Text>
          <Select style={{ width: "100%", marginTop: 6 }} value={newOwner} onChange={setNewOwner}
            showSearch placeholder="Chọn nhân viên"
            options={users.map((u) => ({ value: u, label: u }))} />
        </div>
      </Modal>
    </Card>
  );
}
