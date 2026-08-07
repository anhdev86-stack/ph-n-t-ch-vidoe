"use client";

import React, { useEffect, useState } from "react";
import { Card, Button, Result, Spin, Typography, Tag, Space, message } from "antd";
import { ApiOutlined, CheckCircleTwoTone } from "@ant-design/icons";
import { api } from "../../../lib/api";

const { Paragraph, Text } = Typography;

export default function ConnectPage() {
  const [status, setStatus] = useState<{ connected: boolean; seller_name?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = () => api.get("/tiktok/status").then(setStatus).catch(() => setStatus({ connected: false }));

  useEffect(() => {
    loadStatus();
    const p = new URLSearchParams(window.location.search);
    if (p.get("authorized") === "1") message.success("Kết nối TikTok Shop thành công!");
    if (p.get("authorized") === "0") message.error("Ủy quyền thất bại, thử lại.");
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      const { url } = await api.get("/tiktok/authorize-url");
      window.location.href = url;
    } catch (e) {
      message.error("Chưa cấu hình được link ủy quyền (thiếu TTS_SERVICE_ID?).");
      setLoading(false);
    }
  };

  return (
    <Card title="Kết nối TikTok Shop">
      {status?.connected ? (
        <Result
          icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
          status="success"
          title="Đã kết nối TikTok Shop"
          subTitle={status.seller_name ? <>Shop: <Tag color="green">{status.seller_name}</Tag></> : "Token đang hoạt động, tự động refresh khi hết hạn."}
          extra={<Button onClick={connect} loading={loading}>Kết nối lại shop khác</Button>}
        />
      ) : (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Paragraph>
            Bấm nút bên dưới để ủy quyền cho ứng dụng truy cập dữ liệu affiliate của shop.
            Sau khi đồng ý trên TikTok, hệ thống tự đổi <Text code>auth_code</Text> lấy token và lưu lại.
          </Paragraph>
          <Button type="primary" size="large" icon={<ApiOutlined />} onClick={connect} loading={loading}>
            Kết nối TikTok Shop
          </Button>
          <Text type="secondary">
            Cần đặt <Text code>TTS_APP_KEY</Text>, <Text code>TTS_APP_SECRET</Text>, <Text code>TTS_SERVICE_ID</Text> ở backend,
            và cấu hình Redirect URL trỏ về <Text code>/api/v1/tiktok/callback</Text>.
          </Text>
        </Space>
      )}
    </Card>
  );
}
