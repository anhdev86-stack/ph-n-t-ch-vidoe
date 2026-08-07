"use client";

import React, { useEffect, useState } from "react";
import {
  Card, Button, Form, Input, Radio, Result, Tag, Space, Typography, message, Spin,
} from "antd";
import { ApiOutlined, CheckCircleTwoTone } from "@ant-design/icons";
import { api } from "../../../lib/api";
import { generateTikTokAuthUrl } from "../../../utils/tiktokAuth";

const { Paragraph, Text } = Typography;

interface ConnectForm {
  shopName?: string;
  serviceId: string;
  appKey: string;
  appSecret: string;
}

export default function ConnectPage() {
  const [status, setStatus] = useState<{ connected: boolean; seller_name?: string } | null>(null);
  const [market, setMarket] = useState<"global" | "us">("global");
  const [messageApi, ctx] = message.useMessage();

  const loadStatus = () =>
    api.get("/tiktok/status").then(setStatus).catch(() => setStatus({ connected: false }));

  useEffect(() => {
    loadStatus();
    const p = new URLSearchParams(window.location.search);
    if (p.get("authorized") === "1") messageApi.success("Kết nối TikTok Shop thành công!");
    if (p.get("authorized") === "0") messageApi.error("Ủy quyền thất bại, thử lại.");
  }, []);

  const onFinish = (v: ConnectForm) => {
    // Lưu tạm thông tin để callback dùng lại sau khi TikTok redirect về
    localStorage.setItem(
      "pendingTikTokConnect",
      JSON.stringify({ appKey: v.appKey, appSecret: v.appSecret, serviceId: v.serviceId, shopName: v.shopName || "", market })
    );
    const url = generateTikTokAuthUrl(v.serviceId, market); // tự lưu state + timestamp
    window.location.href = url;
  };

  if (status === null) return <div style={{ padding: 40, textAlign: "center" }}><Spin size="large" /></div>;

  return (
    <Card title="Kết nối TikTok Shop">
      {ctx}
      {status.connected ? (
        <Result
          icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
          status="success"
          title="Đã kết nối TikTok Shop"
          subTitle={status.seller_name ? <>Shop: <Tag color="green">{status.seller_name}</Tag></> : "Token đang hoạt động, tự refresh khi hết hạn."}
          extra={<Button onClick={() => setStatus({ connected: false })}>Kết nối shop khác</Button>}
        />
      ) : (
        <div style={{ maxWidth: 560 }}>
          <Paragraph type="secondary">
            Nhập thông tin ứng dụng TikTok Shop rồi bấm “Kết nối”. Bạn sẽ được đưa sang TikTok để đồng ý;
            sau đó hệ thống tự đổi <Text code>auth_code</Text> lấy token và lưu lại.
          </Paragraph>
          <Form layout="vertical" onFinish={onFinish} requiredMark="optional">
            <Form.Item name="shopName" label="Tên shop (để nhận diện)">
              <Input placeholder="VD: Nhà Là Shop" />
            </Form.Item>
            <Form.Item name="serviceId" label="Service ID (ID Shop / ứng dụng)"
              rules={[{ required: true, message: "Nhập service_id" }]}>
              <Input placeholder="Nhập service_id trong Partner Center" />
            </Form.Item>
            <Form.Item label="Thị trường">
              <Radio.Group value={market} onChange={(e) => setMarket(e.target.value)}>
                <Radio value="global">Global (VN, SEA…)</Radio>
                <Radio value="us">US</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="appKey" label="App Key"
              rules={[{ required: true, message: "Nhập app key" }]}>
              <Input placeholder="Nhập App Key" />
            </Form.Item>
            <Form.Item name="appSecret" label="App Secret"
              rules={[{ required: true, message: "Nhập app secret" }]}>
              <Input.Password placeholder="Nhập App Secret" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" size="large" icon={<ApiOutlined />} htmlType="submit">
                Kết nối TikTok Shop
              </Button>
            </Form.Item>
          </Form>
          <Text type="secondary">
            Cấu hình <b>Redirect URL</b> trong Partner Center trỏ về{" "}
            <Text code>{typeof window !== "undefined" ? window.location.origin : ""}/callback</Text>
          </Text>
        </div>
      )}
    </Card>
  );
}
