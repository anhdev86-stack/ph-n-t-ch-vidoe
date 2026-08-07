"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Space,
  Table,
  message,
  Spin,
  Tooltip,
  Typography,
  Popconfirm,
  Modal,
  Upload,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  KeyOutlined,
  UploadOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  serviceAccountService,
  ServiceAccount,
} from "../../services/serviceAccountService";

const { TextArea } = Input;
const { Text } = Typography;

interface ServiceAccountCardProps {
  isMobile?: boolean;
}

const ServiceAccountCard: React.FC<ServiceAccountCardProps> = ({
  isMobile = false,
}) => {
  const [form] = Form.useForm();
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  // Nội dung file service-account.json đã chọn
  const [credentials, setCredentials] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [detectedEmail, setDetectedEmail] = useState<string>("");

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await serviceAccountService.getAll();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching service accounts:", error);
      message.error("Không thể tải danh sách service account");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const resetModal = () => {
    form.resetFields();
    setCredentials(null);
    setDetectedEmail("");
  };

  const handleAdd = () => {
    resetModal();
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    resetModal();
  };

  // Đọc file JSON (không upload tự động), parse & trích client_email
  const beforeUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as Record<
          string,
          unknown
        >;
        if (json.type !== "service_account" || !json.client_email) {
          message.error(
            "File không phải service account hợp lệ (thiếu type/client_email)",
          );
          return;
        }
        setCredentials(json);
        setDetectedEmail(String(json.client_email));
        message.success(`Đã đọc file: ${String(json.client_email)}`);
      } catch {
        message.error("File JSON không hợp lệ");
      }
    };
    reader.readAsText(file);
    return false; // chặn upload tự động của antd
  };

  const handleSubmit = async () => {
    if (!credentials) {
      message.error("Vui lòng chọn file service-account.json");
      return;
    }
    try {
      setIsSaving(true);
      const values = await form.validateFields();
      await serviceAccountService.create({
        credentials,
        description: values.description,
      });
      message.success("Đã thêm service account!");
      setIsModalVisible(false);
      resetModal();
      await fetchAll();
    } catch (error: unknown) {
      const err = error as { message?: string; errorFields?: unknown };
      if (err.errorFields) return; // lỗi validate form, antd tự hiển thị
      message.error(err.message || "Có lỗi khi thêm service account!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (record: ServiceAccount) => {
    if (!record._id) return;
    try {
      await serviceAccountService.update(record._id, {
        isActive: !record.isActive,
      });
      await fetchAll();
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi cập nhật trạng thái");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await serviceAccountService.delete(id);
      message.success("Đã xóa service account!");
      await fetchAll();
    } catch (error) {
      console.error(error);
      message.error("Có lỗi khi xóa!");
    }
  };

  const columns = [
    {
      title: "Service Account Email",
      dataIndex: "client_email",
      key: "client_email",
      render: (text: string) => (
        <Text copyable style={{ fontSize: isMobile ? 12 : 14 }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (text: string) => text || "-",
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      render: (isActive: boolean, record: ServiceAccount) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggle(record)}
          checkedChildren="Bật"
          unCheckedChildren="Tắt"
          size={isMobile ? "small" : "default"}
        />
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: ServiceAccount) => (
        <Popconfirm
          title="Xác nhận xóa?"
          description="Xóa service account này khỏi hệ thống?"
          onConfirm={() => record._id && handleDelete(record._id)}
          okText="Xóa"
          cancelText="Hủy"
        >
          <Tooltip title="Xóa">
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size={isMobile ? "small" : "middle"}
            />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <div
          className="flex justify-center items-center"
          style={{ minHeight: 200 }}
        >
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        title={
          <Space>
            <KeyOutlined />
            <span>Google Service Accounts ({accounts.length})</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            size={isMobile ? "small" : "middle"}
          >
            {!isMobile && "Thêm service account"}
          </Button>
        }
      >

        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="_id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Tổng ${total} service account`,
            size: isMobile ? "small" : "default",
          }}
          scroll={{ x: isMobile ? 600 : undefined }}
          size={isMobile ? "small" : "middle"}
          locale={{ emptyText: "Chưa có service account nào" }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <KeyOutlined />
            <span>Thêm Service Account</span>
          </Space>
        }
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={isSaving}
        okText="Thêm"
        cancelText="Hủy"
        width={isMobile ? "90%" : 600}
      >
        <Form
          form={form}
          layout="vertical"
          size={isMobile ? "small" : "middle"}
        >
          <Form.Item label="File service-account.json" required>
            <Upload
              accept=".json,application/json"
              beforeUpload={beforeUpload}
              maxCount={1}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>Chọn file JSON</Button>
            </Upload>
            {detectedEmail && (
              <div style={{ marginTop: 8 }}>
                <Text type="success">
                  <CheckCircleOutlined /> {detectedEmail}
                </Text>
              </div>
            )}
          </Form.Item>

          <Form.Item name="description" label="Mô tả (tùy chọn)">
            <TextArea
              rows={2}
              placeholder="Ví dụ: SA dự phòng #2 — dùng khi SA chính hết quota"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ServiceAccountCard;
