"use client";

import React, { useEffect, useState } from "react";
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm,
  Switch, Typography, Result, message,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, TeamOutlined } from "@ant-design/icons";
import { useSession } from "next-auth/react";
import dayjs from "dayjs";
import { api } from "../../../lib/api";

const { Text } = Typography;

interface User { username: string; role: "admin" | "staff"; active: boolean; created_at?: number }

export default function UsersPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [msg, ctx] = message.useMessage();

  const load = () => {
    setLoading(true);
    api.get("/users").then((r) => setItems(r.users || [])).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  // Chặn nhân viên (guard phía client; backend cũng đã chặn 403)
  if (status === "authenticated" && !isAdmin) {
    return <Result status="403" title="Không có quyền" subTitle="Chỉ admin mới được quản lý tài khoản." />;
  }

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ role: "staff" }); setOpen(true); };
  const openEdit = (u: User) => { setEditing(u); form.resetFields(); form.setFieldsValue({ username: u.username, role: u.role }); setOpen(true); };

  const submit = async () => {
    const v = await form.validateFields();
    try {
      if (editing) {
        const body: Record<string, unknown> = { role: v.role };
        if (v.password) body.password = v.password;
        await api.put(`/users/${encodeURIComponent(editing.username)}`, body);
        msg.success("Đã cập nhật");
      } else {
        await api.post("/users", { username: v.username, password: v.password, role: v.role });
        msg.success("Đã tạo tài khoản");
      }
      setOpen(false); load();
    } catch (e) { msg.error(String((e as Error).message || e)); }
  };

  const toggleActive = async (u: User, active: boolean) => {
    try { await api.put(`/users/${encodeURIComponent(u.username)}`, { active }); load(); }
    catch (e) { msg.error(String((e as Error).message || e)); }
  };

  const remove = async (u: User) => {
    try { await api.delete(`/users/${encodeURIComponent(u.username)}`); msg.success("Đã xoá"); load(); }
    catch (e) { msg.error(String((e as Error).message || e)); }
  };

  const columns = [
    { title: "Tên đăng nhập", dataIndex: "username",
      render: (v: string) => <b>{v}</b> },
    { title: "Vai trò", dataIndex: "role", width: 160,
      render: (r: string) => r === "admin"
        ? <Tag color="gold">Admin (full quyền)</Tag>
        : <Tag>Nhân viên</Tag> },
    { title: "Trạng thái", dataIndex: "active", width: 130,
      render: (a: boolean, u: User) => (
        <Switch checked={a} checkedChildren="Bật" unCheckedChildren="Khoá"
          disabled={u.username === session?.user?.name}
          onChange={(val) => toggleActive(u, val)} />
      ) },
    { title: "Tạo lúc", dataIndex: "created_at", width: 160,
      render: (t?: number) => t ? dayjs.unix(t).format("DD/MM/YYYY HH:mm") : "—" },
    { title: "", width: 140, render: (_: unknown, u: User) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)} />
        <Popconfirm title={`Xoá tài khoản "${u.username}"?`} okText="Xoá" cancelText="Huỷ"
          onConfirm={() => remove(u)} disabled={u.username === session?.user?.name}>
          <Button size="small" danger icon={<DeleteOutlined />}
            disabled={u.username === session?.user?.name} />
        </Popconfirm>
      </Space>
    ) },
  ];

  return (
    <Card
      title={<span><TeamOutlined /> Quản lý tài khoản</span>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm tài khoản</Button>}
    >
      {ctx}
      <Text type="secondary">
        <b>Admin</b>: toàn quyền. <b>Nhân viên</b>: dùng mọi chức năng phân tích, nhưng
        không thấy “Kết nối TikTok” và “Quản lý tài khoản”.
      </Text>
      <Table rowKey="username" columns={columns} dataSource={items} loading={loading}
        style={{ marginTop: 16 }} pagination={{ pageSize: 10 }} />

      <Modal open={open} onCancel={() => setOpen(false)} onOk={submit}
        title={editing ? `Sửa: ${editing.username}` : "Thêm tài khoản"}
        okText={editing ? "Lưu" : "Tạo"} cancelText="Huỷ" destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Tên đăng nhập"
            rules={[{ required: !editing, message: "Nhập tên đăng nhập" }]}>
            <Input disabled={!!editing} placeholder="vd: nhanvien1" />
          </Form.Item>
          <Form.Item name="password" label={editing ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu"}
            rules={editing ? [] : [{ required: true, message: "Nhập mật khẩu" }]}>
            <Input.Password placeholder="Mật khẩu" />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={[
              { value: "staff", label: "Nhân viên (mọi chức năng trừ uỷ quyền & quản lý tài khoản)" },
              { value: "admin", label: "Admin (full quyền)" },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
