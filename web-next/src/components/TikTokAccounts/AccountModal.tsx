import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  FormInstance,
  Tabs,
  Typography,
  Button,
  message,
  Radio,
  Space,
  RadioChangeEvent,
  Alert,
  Card,
  Row,
  Col,
  List,
  Tag,
  Divider,
} from "antd";
import {
  KeyOutlined,
  LoginOutlined,
  GlobalOutlined,
  ShopOutlined,
  MailOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import { TikTokAccount } from "../../types/tikTokTypes";
import { generateTikTokAuthUrl } from "../../utils/tiktokAuth";
import { api } from "../../lib/api";

const { Text } = Typography;

interface AccountModalProps {
  isModalVisible: boolean;
  form: FormInstance;
  editingId: string | null;
  isMobile: boolean;
  handleOk: () => void;
  handleCancel: () => void;
  currentAccount?: TikTokAccount;
  isSubmitting?: boolean;
}

const AccountModal: React.FC<AccountModalProps> = ({
  isModalVisible,
  form,
  editingId,
  isMobile,
  handleOk,
  handleCancel,
  currentAccount,
  isSubmitting = false,
}) => {
  const [market, setMarket] = useState<"us" | "global">("global");
  const [serviceAccountEmails, setServiceAccountEmails] = useState<string[]>(
    []
  );
  const [loadingServiceAccounts, setLoadingServiceAccounts] =
    useState<boolean>(false);

  const handleMarketChange = (e: RadioChangeEvent) => {
    setMarket(e.target.value);
  };

  // Load Service Account emails on component mount
  useEffect(() => {
    const fetchServiceAccountEmails = async () => {
      try {
        setLoadingServiceAccounts(true);
        const response = await api.get("/accounts/service-accounts/emails");
        if (response.emails) {
          setServiceAccountEmails(response.emails);
        }
      } catch (error) {
        console.error("Error fetching service account emails:", error);
        message.error("Không thể tải danh sách Service Account emails");
      } finally {
        setLoadingServiceAccounts(false);
      }
    };

    if (isModalVisible) {
      fetchServiceAccountEmails();
    }
  }, [isModalVisible]);

  const handleAuthorize = () => {
    try {
      // Xác thực các trường form trước (bao gồm cả Sheet ID)
      form
        .validateFields([
          "appKey",
          "appSecret",
          "serviceId",
          "shopName",
          "sheetId",
        ])
        .then((values) => {
          // Tách 'email' ra khỏi payload: backend (ValidationPipe forbidNonWhitelisted)
          // chỉ chấp nhận field trong DTO — email được chuyển thành sheetEmails.
          const { email, ...accountFields } = values;

          // Khi sửa mà để trống App Secret → bỏ khỏi payload để backend giữ nguyên secret cũ
          // (không gửi chuỗi rỗng làm ghi đè mất secret).
          if (editingId && !accountFields.appSecret) {
            delete accountFields.appSecret;
          }

          const pendingAccountData = {
            ...accountFields,
            id: editingId || undefined,
            // Chỉ thêm email vào sheetEmails nếu có email được nhập
            sheetEmails: email ? [email] : undefined,
          };

          localStorage.setItem(
            "pendingTikTokAccount",
            JSON.stringify(pendingAccountData)
          );

          // Tạo URL ủy quyền TikTok dựa trên thị trường đã chọn
          const authUrl = generateTikTokAuthUrl(values.serviceId, market);

          // Chuyển hướng đến trang ủy quyền TikTok
          window.location.href = authUrl;
        })
        .catch((error) => {
          console.error("Xác thực thất bại:", error);
          message.error("Vui lòng điền đầy đủ thông tin trước khi ủy quyền");
        });
    } catch (error) {
      console.error("Lỗi trong quá trình ủy quyền:", error);
      message.error("Có lỗi xảy ra khi xử lý ủy quyền");
    }
  };

  // Define tab items for the Tabs component
  const tabItems = [
    {
      key: "basic",
      label: "Thông tin cơ bản",
      children: (
        <>
          <Form
            form={form}
            layout="vertical"
            name="tiktok_account_form"
            size={isMobile ? "small" : "middle"}
          >
            <Card title="Thông tin Shop" variant="outlined" size="small">
              <Row gutter={16}>
                <Col span={isMobile ? 24 : 12}>
                  <Form.Item
                    name="shopName"
                    label={
                      <span>
                        <ShopOutlined /> Tên Shop(Sheet)
                      </span>
                    }
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập tên Shop!",
                      },
                    ]}
                  >
                    <Input placeholder="Nhập tên Shop của bạn" />
                  </Form.Item>
                </Col>
                <Col span={isMobile ? 24 : 12}>
                  <Form.Item
                    name="serviceId"
                    label={
                      <span>
                        <IdcardOutlined /> ID Shop
                      </span>
                    }
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập ID Shop!",
                      },
                    ]}
                  >
                    <Input placeholder="Nhập ID Shop (service_id)" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={isMobile ? 24 : 12}>
                  <Form.Item
                    name="email"
                    label={
                      <span>
                        <MailOutlined /> Email (tùy chọn)
                      </span>
                    }
                    rules={[
                      {
                        type: "email",
                        message: "Vui lòng nhập email hợp lệ!",
                      },
                    ]}
                  >
                    <Input placeholder="Nhập email để chia sẻ báo cáo (tùy chọn)" />
                  </Form.Item>
                </Col>
                <Col span={isMobile ? 24 : 12}>
                  <Form.Item
                    label={
                      <span>
                        <GlobalOutlined /> Thị trường
                      </span>
                    }
                    required
                  >
                    <Radio.Group onChange={handleMarketChange} value={market}>
                      <Space direction="horizontal">
                        <Radio value="global">Global</Radio>
                        <Radio value="us">US</Radio>
                      </Space>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card
              title="Google Sheets"
              variant="outlined"
              size="small"
              className="mt-3"
            >
              <Form.Item
                name="sheetId"
                label="Google Sheet ID"
                rules={[
                  {
                    required: true,
                    message: "Vui lòng nhập Google Sheet ID!",
                  },
                ]}
                extra="Nhập ID của Google Sheet đã tạo sẵn để lưu báo cáo"
              >
                <Input placeholder="Ví dụ: 1CSu7CbtmiDnbHG3YtRTe9k1okleu6d43YyVy8Jc2Aro" />
              </Form.Item>

              <Divider />

              <Alert
                message="Quan trọng: Chia sẻ quyền chỉnh sửa Google Sheet"
                description={
                  <div>
                    <p>
                      Bạn cần chia sẻ Google Sheet với các Service Account
                      emails sau để hệ thống có thể ghi dữ liệu:
                    </p>
                    {loadingServiceAccounts ? (
                      <div>Đang tải danh sách emails...</div>
                    ) : (
                      <List
                        size="small"
                        dataSource={serviceAccountEmails}
                        renderItem={(email) => (
                          <List.Item>
                            <Tag color="blue">{email}</Tag>
                          </List.Item>
                        )}
                      />
                    )}
                    <p>
                      <strong>Cách chia sẻ:</strong> Mở Google Sheet → Nhấn nút
                      &quot;Chia sẻ&quot; → Thêm từng email trên với quyền
                      &quot;Người chỉnh sửa&quot;
                    </p>
                  </div>
                }
                type="warning"
                showIcon
              />
            </Card>

            <Card
              title="Thông tin API"
              variant="outlined"
              size="small"
              className="mt-3"
            >
              <Row gutter={16}>
                <Col span={isMobile ? 24 : 12}>
                  <Form.Item
                    name="appKey"
                    label="App Key"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập khóa ứng dụng!",
                      },
                    ]}
                  >
                    <Input
                      prefix={<KeyOutlined />}
                      placeholder="Nhập khóa ứng dụng"
                    />
                  </Form.Item>
                </Col>
                <Col span={isMobile ? 24 : 12}>
                  <Form.Item
                    name="appSecret"
                    label="App Secret"
                    rules={[
                      {
                        // Chỉ bắt buộc khi TẠO MỚI. Khi sửa, để trống = giữ nguyên secret cũ
                        // (backend không trả App Secret về client vì lý do bảo mật).
                        required: !editingId,
                        message: "Vui lòng nhập khóa bí mật!",
                      },
                    ]}
                    extra={
                      editingId
                        ? "Để trống nếu không thay đổi App Secret hiện tại"
                        : undefined
                    }
                  >
                    <Input.Password
                      prefix={<KeyOutlined />}
                      placeholder={
                        editingId
                          ? "Để trống nếu không đổi"
                          : "Nhập khóa bí mật ứng dụng"
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Form>

          <Alert
            className="mt-3"
            message={
              <div>
                <div>
                  Nhấn nút &quot;Ủy quyền với TikTok&quot; để tiếp tục. Bạn sẽ
                  được chuyển hướng đến trang đăng nhập TikTok Shop.
                </div>
                <div className="mt-2 text-sm">
                  <strong>Lưu ý:</strong> Hãy đảm bảo bạn đã tạo Google Sheet và
                  chia sẻ quyền chỉnh sửa với tất cả Service Account emails ở
                  phần trên. Nếu bạn muốn chia sẻ thêm với email khác, vui lòng
                  nhập email ở phần thông tin shop.
                </div>
              </div>
            }
            type="info"
            showIcon
          />
        </>
      ),
    },
  ];

  // Add conditional tabs for editing mode
  if (editingId) {
    tabItems.push({
      key: "shops",
      label: "Thông tin Shop",
      children: (
        <div style={{ padding: "16px 0" }}>
          {currentAccount?.shopCipher &&
          currentAccount.shopCipher.length > 0 ? (
            <div>
              {currentAccount.shopCipher.map((shop) => (
                <Card
                  key={shop.id}
                  size="small"
                  variant="outlined"
                  style={{ marginBottom: 16 }}
                >
                  <Typography.Title level={5}>{shop.name}</Typography.Title>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text strong>ID: </Text>
                      <Text>{shop.id}</Text>
                    </Col>
                    <Col span={8}>
                      <Text strong>Region: </Text>
                      <Text>{shop.region}</Text>
                    </Col>
                    <Col span={8}>
                      <Text strong>Seller Type: </Text>
                      <Text>{shop.seller_type}</Text>
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <Text type="secondary">Chưa có thông tin Shop</Text>
            </div>
          )}
        </div>
      ),
    });

    tabItems.push({
      key: "token",
      label: "Thông tin Token",
      children: (
        <Card size="small" variant="outlined">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Access Token: </Text>
              <Text>
                {currentAccount?.accessToken
                  ? `${currentAccount.accessToken.substring(0, 10)}...`
                  : "Không có"}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Refresh Token: </Text>
              <Text>
                {currentAccount?.refreshToken
                  ? `${currentAccount.refreshToken.substring(0, 10)}...`
                  : "Không có"}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>Access Token Expire In: </Text>
              <Text>{currentAccount?.accessTokenExpireIn || "Không có"}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Refresh Token Expire In: </Text>
              <Text>{currentAccount?.refreshTokenExpireIn || "Không có"}</Text>
            </Col>
          </Row>
        </Card>
      ),
    });
  }

  return (
    <Modal
      title={editingId ? "Chỉnh sửa tài khoản TikTok" : "Thêm tài khoản TikTok"}
      open={isModalVisible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Lưu"
      cancelText="Hủy"
      width={isMobile ? "95%" : 700}
      centered
      confirmLoading={isSubmitting}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Hủy
        </Button>,
        <Button
          key="authorize"
          type="primary"
          icon={<LoginOutlined />}
          onClick={handleAuthorize}
        >
          Ủy quyền với TikTok
        </Button>,
      ]}
    >
      <Tabs defaultActiveKey="basic" items={tabItems} />
    </Modal>
  );
};

export default AccountModal;
