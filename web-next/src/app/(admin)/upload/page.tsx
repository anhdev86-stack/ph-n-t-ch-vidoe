"use client";

import React, { useEffect, useState } from "react";
import {
  Card, Upload, Table, Button, Popconfirm, Typography, message, Tag, Space,
} from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined, PlayCircleOutlined, DeleteOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { useAuth } from "../../../lib/auth";
import { api } from "../../../lib/api";
import CommonAnalyze from "../../../components/CommonAnalyze";

const { Dragger } = Upload;
const { Text } = Typography;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Up { id: string; name: string; size: number; uploaded_at: number }
const fsize = (b: number) => b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : (b / 1e3).toFixed(0) + " KB";

export default function UploadPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Up[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [msg, ctx] = message.useMessage();

  const selectedItems = items
    .filter((r) => selectedKeys.includes(r.id))
    .map((r) => ({ video_id: r.id, source: "upload", title: r.name }));

  const load = () => {
    setLoading(true);
    api.get("/uploads").then((r) => setItems(r.uploads || [])).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const draggerProps: UploadProps = {
    name: "file",
    multiple: true,
    accept: "video/*",
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError, onProgress }) => {
      const fd = new FormData();
      fd.append("file", file as File);
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/uploads`);
        if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.upload.onprogress = (e) => e.total && onProgress?.({ percent: (e.loaded / e.total) * 100 });
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onSuccess?.(JSON.parse(xhr.responseText));
            msg.success(`Đã tải lên: ${(file as File).name}`);
            load();
          } else { onError?.(new Error(xhr.responseText)); msg.error("Tải lên thất bại"); }
        };
        xhr.onerror = () => { onError?.(new Error("network")); msg.error("Lỗi mạng khi tải lên"); };
        xhr.send(fd);
      } catch (e) { onError?.(e as Error); }
    },
  };

  const remove = async (id: string) => {
    await api.delete(`/uploads/${id}`);
    msg.success("Đã xoá");
    load();
  };

  const columns = [
    { title: "Video", dataIndex: "id", width: 120,
      render: (id: string) => (
        <video src={`${API_URL}/analyze/${id}/video`} muted
          style={{ width: 90, height: 120, objectFit: "cover", borderRadius: 8, background: "#000", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
          onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          onClick={() => router.push(`/?video_id=${id}&source=upload`)} />
      ) },
    { title: "Tên file", dataIndex: "name", ellipsis: true },
    { title: "Dung lượng", dataIndex: "size", width: 120, render: fsize },
    { title: "Tải lên", dataIndex: "uploaded_at", width: 160,
      render: (t: number) => dayjs.unix(t).format("DD/MM/YYYY HH:mm") },
    { title: "", width: 220, render: (_: unknown, r: Up) => (
      <Space>
        <Button type="primary" icon={<PlayCircleOutlined />}
          onClick={() => router.push(`/?video_id=${r.id}&source=upload&title=${encodeURIComponent(r.name)}`)}>
          Phân tích
        </Button>
        <Popconfirm title="Xoá video này?" okText="Xoá" cancelText="Huỷ" onConfirm={() => remove(r.id)}>
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) },
  ];

  return (
    <Card title="Upload video đối thủ để phân tích">
      {ctx}
      <Dragger {...draggerProps} style={{ marginBottom: 20 }}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Kéo-thả hoặc bấm để tải video lên</p>
        <p className="ant-upload-hint">
          Hỗ trợ video mọi ngôn ngữ. Bấm “Phân tích” — hệ thống tự bóc lời thoại, <b>dịch chuẩn sang tiếng Việt</b> rồi tạo storyboard.
        </p>
      </Dragger>
      <Space style={{ marginBottom: 12 }}>
        <CommonAnalyze items={selectedItems} />
        {selectedItems.length > 0 && <Text type="secondary">Đã chọn {selectedItems.length} video</Text>}
      </Space>
      <Table rowKey="id" columns={columns} dataSource={items} loading={loading}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        pagination={{ pageSize: 10 }} locale={{ emptyText: "Chưa có video nào. Tải lên ở trên." }} />
    </Card>
  );
}
