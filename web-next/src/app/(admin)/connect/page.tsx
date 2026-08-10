"use client";

import React, { useEffect, useState } from "react";
import {
  Row, Col, Card, Button, Form, Input, Radio, Tag, Typography, message,
  List, Empty, Popconfirm, Avatar, Badge, Result, Modal,
} from "antd";
import { ApiOutlined, ShopOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { useSession } from "next-auth/react";
import { api } from "../../../lib/api";
import { generateTikTokAuthUrl } from "../../../utils/tiktokAuth";

const { Paragraph, Text } = Typography;

interface ConnectForm { shopName?: string; serviceId: string; appKey: string; appSecret: string }
interface Shop {
  id: string; shop_name: string; seller_name: string; service_id: string;
  market: string; connected: boolean; has_cookies?: boolean; created_at?: number;
}

export default function ConnectPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState<"global" | "us">("global");
  const [origin, setOrigin] = useState("");
  const [form] = Form.useForm();
  const [messageApi, ctx] = message.useMessage();

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const loadShops = () => {
    setLoading(true);
    api.get("/tiktok/shops")
      .then((r) => setShops(r.shops || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadShops();
    const p = new URLSearchParams(window.location.search);
    if (p.get("authorized") === "1") messageApi.success("Đã thêm shop TikTok thành công!");
    if (p.get("authorized") === "0") messageApi.error("Ủy quyền thất bại, thử lại.");
  }, []);

  const onFinish = (v: ConnectForm) => {
    localStorage.setItem(
      "pendingTikTokConnect",
      JSON.stringify({ appKey: v.appKey, appSecret: v.appSecret, serviceId: v.serviceId, shopName: v.shopName || "", market })
    );
    window.location.href = generateTikTokAuthUrl(v.serviceId, market);
  };

  const removeShop = async (id: string) => {
    await api.delete(`/tiktok/shops/${id}`);
    messageApi.success("Đã xoá shop");
    loadShops();
  };

  // Chặn nhân viên (backend cũng đã trả 403 cho connect/xoá shop)
  if (status === "authenticated" && !isAdmin) {
    return <Result status="403" title="Không có quyền"
      subTitle="Chỉ admin mới được uỷ quyền / quản lý shop TikTok." />;
  }

  return (
    <>
      {ctx}
      <Row gutter={16}>
        {/* FORM THÊM SHOP */}
        <Col xs={24} lg={13}>
          <Card title="Thêm shop TikTok">
            <Paragraph type="secondary">
              Nhập thông tin ứng dụng TikTok Shop rồi bấm “Kết nối”. Bạn sẽ được đưa sang TikTok để đồng ý;
              sau đó hệ thống tự đổi <Text code>auth_code</Text> lấy token và thêm shop vào danh sách.
            </Paragraph>
            <Form form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">
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
              <Form.Item name="appKey" label="App Key" rules={[{ required: true, message: "Nhập app key" }]}>
                <Input placeholder="Nhập App Key" />
              </Form.Item>
              <Form.Item name="appSecret" label="App Secret" rules={[{ required: true, message: "Nhập app secret" }]}>
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
              <Text code>{origin}/callback</Text>
            </Text>
          </Card>
        </Col>

        {/* DANH SÁCH SHOP ĐÃ ỦY QUYỀN */}
        <Col xs={24} lg={11}>
          <Card
            title={<>Shop đã ủy quyền <Badge count={shops.length} showZero color="#B8912F" style={{ marginLeft: 6 }} /></>}
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadShops}>Tải lại</Button>}
          >
            {shops.length === 0 && !loading ? (
              <Empty description="Chưa có shop nào. Thêm shop ở cột bên trái." />
            ) : (
              <List
                loading={loading}
                dataSource={shops}
                renderItem={(s) => (
                  <List.Item
                    actions={[
                      <Popconfirm key="del" title="Xoá shop này?" okText="Xoá" cancelText="Huỷ"
                        onConfirm={() => removeShop(s.id)}>
                        <Button danger type="text" icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar style={{ background: "#B8912F" }} icon={<ShopOutlined />} />}
                      title={<>{s.shop_name || s.seller_name || "(shop)"} {s.connected && <Tag color="green">đã kết nối</Tag>}</>}
                      description={
                        <span>
                          {s.service_id && <Tag>service_id: {s.service_id}</Tag>}
                          <Tag color={s.market === "us" ? "blue" : "gold"}>{s.market}</Tag>
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
