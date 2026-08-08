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
  const [cookieShop, setCookieShop] = useState<Shop | null>(null);
  const [cookieText, setCookieText] = useState("");
  const [savingCk, setSavingCk] = useState(false);

  const saveCookies = async () => {
    if (!cookieShop) return;
    setSavingCk(true);
    try {
      await api.put(`/tiktok/shops/${cookieShop.id}/cookies`, { cookies: cookieText });
      messageApi.success("Đã lưu cookies. Giờ xem được video giỏ hàng của shop này.");
      setCookieShop(null); setCookieText(""); loadShops();
    } catch (e) { messageApi.error(String((e as Error).message || e)); }
    finally { setSavingCk(false); }
  };

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
                      <Button key="ck" type="link" size="small"
                        onClick={() => { setCookieShop(s); setCookieText(""); }}>
                        {s.has_cookies ? "Sửa cookies" : "Dán cookies"}
                      </Button>,
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
                          <Tag color={s.has_cookies ? "green" : "default"}>
                            {s.has_cookies ? "✓ có cookies (xem được video giỏ hàng)" : "chưa có cookies"}
                          </Tag>
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

      <Modal open={!!cookieShop} onCancel={() => setCookieShop(null)} onOk={saveCookies}
        confirmLoading={savingCk} okText="Lưu cookies" cancelText="Huỷ" width={640}
        title={`Dán cookies TikTok — ${cookieShop?.shop_name || cookieShop?.seller_name || ""}`}>
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Dán cookies để xem/tải được <b>video giỏ hàng</b> (TikTok chỉ trả video khi đã đăng nhập).
          Cách lấy: cài extension <Text code>Get cookies.txt LOCALLY</Text> → vào <Text code>tiktok.com</Text> (đang đăng nhập)
          → bấm extension → <b>Export</b> (định dạng Netscape) → mở file, copy toàn bộ, dán vào đây.
        </Paragraph>
        <Input.TextArea rows={10} value={cookieText} onChange={(e) => setCookieText(e.target.value)}
          placeholder="# Netscape HTTP Cookie File&#10;.tiktok.com  TRUE  /  TRUE  ...  sessionid  xxxxxxxx&#10;..."
          style={{ fontFamily: "monospace", fontSize: 12 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Cookies chỉ lưu trên server tool của bạn, không chia sẻ. Hết hạn sau ~vài tuần → dán lại khi cần.
        </Text>
      </Modal>
    </>
  );
}
