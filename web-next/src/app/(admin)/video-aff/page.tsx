"use client";

import React, { useEffect, useState } from "react";
import {
  Card, Row, Col, Select, DatePicker, Button, Table, Statistic, Tag, Alert, Typography, List, Spin,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { api } from "../../../lib/api";

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface Shop { id: string; shop_name: string; seller_name: string }
interface Video {
  videoId: string; videoLink: string; title: string; username: string;
  gmv: number; currency: string; orders: number; itemsSold: number;
  views: number; ctr: number; cvr: number; gpm: number; postedAt: string;
}
interface Totals { count: number; gmv: number; views: number; orders: number; ctr: number; cvr: number }

const vnd = (n: number) => (n || 0).toLocaleString("vi-VN");
const numf = (n: number) => (n || 0).toLocaleString("vi-VN");

export default function VideoAffPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState<string>();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, "day"), dayjs()]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [products, setProducts] = useState<Record<string, { name: string; gmv: number; unitsSold: number }[] | "loading">>({});

  useEffect(() => {
    api.get("/tiktok/shops").then((r) => {
      setShops(r.shops || []);
      if (r.shops?.[0]) setShopId(r.shops[0].id);
    }).catch(() => {});
  }, []);

  const analyze = async () => {
    setLoading(true); setErr(""); setVideos([]); setTotals(null); setProducts({});
    const [s, e] = range;
    const qs = new URLSearchParams({
      start_date: s.format("YYYY-MM-DD"), end_date: e.format("YYYY-MM-DD"), sort_field: "gmv",
      ...(shopId ? { shop_id: shopId } : {}),
    });
    try {
      const r = await api.get(`/videos?${qs}`);
      if (r.error) { setErr(r.error); return; }
      setVideos(r.videos || []);
      setTotals(r.totals || null);
    } catch (e2) { setErr(String((e2 as Error).message || e2)); }
    finally { setLoading(false); }
  };

  const loadProducts = async (v: Video) => {
    setProducts((p) => ({ ...p, [v.videoId]: "loading" }));
    const [s, e] = range;
    const qs = new URLSearchParams({
      start_date: s.format("YYYY-MM-DD"), end_date: e.format("YYYY-MM-DD"),
      ...(shopId ? { shop_id: shopId } : {}),
    });
    try {
      const r = await api.get(`/videos/${v.videoId}/products?${qs}`);
      setProducts((p) => ({ ...p, [v.videoId]: r.products || [] }));
    } catch { setProducts((p) => ({ ...p, [v.videoId]: [] })); }
  };

  const columns: ColumnsType<Video> = [
    { title: "ID video", dataIndex: "videoId", width: 170, ellipsis: true },
    { title: "Link", dataIndex: "videoLink", width: 60,
      render: (u: string) => u ? <a href={u} target="_blank" rel="noopener">Xem</a> : "—" },
    { title: "Tiêu đề", dataIndex: "title", width: 240,
      onCell: () => ({ style: { maxWidth: 240 } }),
      render: (t: string) => (
        <div title={t} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" }}>{t}</div>
      ) },
    { title: "Người đăng", dataIndex: "username", width: 130, ellipsis: true },
    { title: "GMV", dataIndex: "gmv", width: 130, align: "right",
      sorter: (a, b) => a.gmv - b.gmv, defaultSortOrder: "descend",
      render: (g: number, r) => `${vnd(g)} ${r.currency || ""}` },
    { title: "Đơn", dataIndex: "orders", width: 70, align: "right", sorter: (a, b) => a.orders - b.orders },
    { title: "Lượt xem", dataIndex: "views", width: 100, align: "right",
      sorter: (a, b) => a.views - b.views, render: numf },
    { title: "CTR", dataIndex: "ctr", width: 80, align: "right",
      sorter: (a, b) => a.ctr - b.ctr, render: (v: number) => `${v}%` },
    { title: "CVR", dataIndex: "cvr", width: 80, align: "right",
      sorter: (a, b) => a.cvr - b.cvr, render: (v: number) => `${v}%` },
    { title: "GPM", dataIndex: "gpm", width: 100, align: "right",
      sorter: (a, b) => a.gpm - b.gpm, render: numf },
    { title: "Ngày đăng", dataIndex: "postedAt", width: 140 },
  ];

  return (
    <Card title="Phân tích Video Affiliate">
      <Row gutter={12} align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Select
            style={{ minWidth: 200 }} placeholder="Chọn shop" value={shopId} onChange={setShopId}
            options={shops.map((s) => ({ value: s.id, label: s.shop_name || s.seller_name || s.id }))}
            notFoundContent="Chưa có shop — vào tab Kết nối TikTok"
          />
        </Col>
        <Col><RangePicker value={range} onChange={(r) => r && setRange(r as [Dayjs, Dayjs])} format="DD/MM/YYYY" /></Col>
        <Col><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={analyze}>Phân tích</Button></Col>
      </Row>

      {err && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không lấy được video"
        description={<>{err}<br /><Text type="secondary">Chọn shop đã kết nối ở tab “Kết nối TikTok”.</Text></>} />}

      {totals && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Card><Statistic title="Tổng video" value={totals.count} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="GMV" value={vnd(totals.gmv)} suffix="₫" /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Lượt xem" value={numf(totals.views)} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="CTR / CVR" value={`${totals.ctr}% / ${totals.cvr}%`} /></Card></Col>
        </Row>
      )}

      <Table
        rowKey="videoId"
        columns={columns}
        dataSource={videos}
        loading={loading}
        size="small"
        scroll={{ x: 1200 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} video` }}
        expandable={{
          onExpand: (expanded, v) => { if (expanded && !products[v.videoId]) loadProducts(v); },
          expandedRowRender: (v) => {
            const p = products[v.videoId];
            if (p === "loading") return <Spin size="small" />;
            if (!p || p.length === 0) return <Text type="secondary">Không có sản phẩm bán ra trong khoảng này.</Text>;
            return (
              <List size="small" dataSource={p}
                renderItem={(it) => (
                  <List.Item>
                    <Text>{it.name}</Text>
                    <span><Tag>{it.unitsSold} đã bán</Tag><Tag color="gold">{vnd(it.gmv)} ₫</Tag></span>
                  </List.Item>
                )} />
            );
          },
        }}
      />
    </Card>
  );
}
