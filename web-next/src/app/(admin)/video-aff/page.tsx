"use client";

import React, { useEffect, useState } from "react";
import {
  Card, Row, Col, Select, DatePicker, Button, Table, Statistic, Tag, Alert, Typography,
  Popover, Spin, Progress, Space, message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined, DownloadOutlined, PlayCircleOutlined } from "@ant-design/icons";
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
type Product = { name: string; gmv: number; unitsSold: number };
type ProdState = Product[] | "loading" | undefined;

const numf = (n: number) => (n || 0).toLocaleString("vi-VN");

async function pool<T>(items: T[], worker: (x: T) => Promise<void>, size = 4) {
  const q = [...items];
  const run = async () => { while (q.length) { const it = q.shift()!; await worker(it); } };
  await Promise.all(Array.from({ length: size }, run));
}

export default function VideoAffPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState<string>();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, "day"), dayjs()]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [products, setProducts] = useState<Record<string, ProdState>>({});
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [msg, ctx] = message.useMessage();

  useEffect(() => {
    api.get("/tiktok/shops").then((r) => {
      setShops(r.shops || []);
      if (r.shops?.[0]) setShopId(r.shops[0].id);
    }).catch(() => {});
  }, []);

  const qsDates = () => {
    const [s, e] = range;
    return { start_date: s.format("YYYY-MM-DD"), end_date: e.format("YYYY-MM-DD"),
             ...(shopId ? { shop_id: shopId } : {}) };
  };

  const analyze = async () => {
    setLoading(true); setErr(""); setVideos([]); setTotals(null); setProducts({});
    try {
      const r = await api.get(`/videos?${new URLSearchParams({ ...qsDates(), sort_field: "gmv" })}`);
      if (r.error) { setErr(r.error); return; }
      const list: Video[] = r.videos || [];
      setVideos(list); setTotals(r.totals || null);
      autoLoadProducts(list); // tự lấy sản phẩm song song, không cần bấm
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  };

  // Tự động đổ sản phẩm cho các video có đơn (chạy nền, song song 4 luồng)
  const autoLoadProducts = async (list: Video[]) => {
    const targets = list.filter((v) => v.orders > 0);
    if (!targets.length) return;
    setBulk({ done: 0, total: targets.length });
    let done = 0;
    await pool(targets, async (v) => { await loadProducts(v.videoId); done++; setBulk({ done, total: targets.length }); }, 4);
    setBulk(null);
  };

  const loadProducts = async (videoId: string) => {
    setProducts((p) => ({ ...p, [videoId]: "loading" }));
    try {
      const r = await api.get(`/videos/${videoId}/products?${new URLSearchParams(qsDates())}`);
      setProducts((p) => ({ ...p, [videoId]: r.products || [] }));
    } catch { setProducts((p) => ({ ...p, [videoId]: [] })); }
  };

  const csvCell = (s: unknown) => {
    const t = s == null ? "" : String(s);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const exportExcel = () => {
    const header = ["ID video", "Link", "Tiêu đề", "Người đăng", "Sản phẩm đã bán",
      "GMV", "Tiền tệ", "Đơn", "Lượt xem", "CTR (%)", "CVR (%)", "GPM", "Ngày đăng"];
    const rows = videos.map((v) => {
      const p = products[v.videoId];
      const prod = Array.isArray(p) ? p.map((x) => x.name).join(" · ") : "";
      return [v.videoId, v.videoLink, v.title, v.username, prod, v.gmv, v.currency,
        v.orders, v.views, v.ctr, v.cvr, v.gpm, v.postedAt];
    });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `video-affiliate-${dayjs().format("YYYYMMDD-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    msg.success(`Đã xuất ${videos.length} video`);
  };

  const clip = (t: string) => (
    <div title={t} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" }}>{t}</div>
  );

  const columns: ColumnsType<Video> = [
    { title: "ID video", dataIndex: "videoId", width: 170, ellipsis: true },
    { title: "Link", dataIndex: "videoLink", width: 66, render: (u: string, v) =>
        u ? (
          <Popover trigger="hover" mouseEnterDelay={0.3} placement="right"
            content={
              <iframe title="preview" src={`https://www.tiktok.com/player/v1/${v.videoId}`}
                width={240} height={420} style={{ border: 0, borderRadius: 8, display: "block" }}
                allow="autoplay; encrypted-media; fullscreen" />
            }>
            <a href={u} target="_blank" rel="noopener"><PlayCircleOutlined /> Xem</a>
          </Popover>
        ) : "—" },
    { title: "Tiêu đề", dataIndex: "title", width: 240,
      onCell: () => ({ style: { maxWidth: 240 } }), render: clip },
    { title: "Người đăng", dataIndex: "username", width: 130, ellipsis: true },
    { title: "Sản phẩm đã bán", dataIndex: "products", width: 240,
      onCell: () => ({ style: { maxWidth: 240 } }),
      render: (_: unknown, v) => {
        const p = products[v.videoId];
        if (p === "loading") return <Spin size="small" />;
        if (p === undefined) return v.orders > 0 ? <a onClick={() => loadProducts(v.videoId)}>Tải</a> : <Text type="secondary">—</Text>;
        if (p.length === 0) return <Text type="secondary">—</Text>;
        return clip(p.map((x) => x.name).join(" · "));
      } },
    { title: "GMV", dataIndex: "gmv", width: 130, align: "right",
      sorter: (a, b) => a.gmv - b.gmv, defaultSortOrder: "descend",
      render: (g: number, r) => `${numf(g)} ${r.currency || ""}` },
    { title: "Đơn", dataIndex: "orders", width: 70, align: "right", sorter: (a, b) => a.orders - b.orders },
    { title: "Lượt xem", dataIndex: "views", width: 100, align: "right",
      sorter: (a, b) => a.views - b.views, render: numf },
    { title: "CTR", dataIndex: "ctr", width: 80, align: "right",
      sorter: (a, b) => a.ctr - b.ctr, render: (v: number) => `${v}%` },
    { title: "CVR", dataIndex: "cvr", width: 80, align: "right",
      sorter: (a, b) => a.cvr - b.cvr, render: (v: number) => `${v}%` },
    { title: "GPM", dataIndex: "gpm", width: 100, align: "right",
      sorter: (a, b) => a.gpm - b.gpm, render: numf },
    { title: "Ngày đăng", dataIndex: "postedAt", width: 150 },
  ];

  return (
    <Card title="Phân tích Video Affiliate">
      {ctx}
      <Row gutter={12} align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Select style={{ minWidth: 200 }} placeholder="Chọn shop" value={shopId} onChange={setShopId}
            options={shops.map((s) => ({ value: s.id, label: s.shop_name || s.seller_name || s.id }))}
            notFoundContent="Chưa có shop — vào tab Kết nối TikTok" />
        </Col>
        <Col><RangePicker value={range} onChange={(r) => r && setRange(r as [Dayjs, Dayjs])} format="DD/MM/YYYY" /></Col>
        <Col><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={analyze}>Phân tích</Button></Col>
      </Row>

      {err && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không lấy được video"
        description={<>{err}<br /><Text type="secondary">Chọn shop đã kết nối ở tab “Kết nối TikTok”.</Text></>} />}

      {totals && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}><Card><Statistic title="Tổng video" value={totals.count} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="GMV" value={numf(totals.gmv)} suffix="₫" /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="Lượt xem" value={numf(totals.views)} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="CTR / CVR" value={`${totals.ctr}% / ${totals.cvr}%`} /></Card></Col>
          </Row>
          <Space style={{ marginBottom: 12 }} wrap>
            <Button type="primary" ghost icon={<DownloadOutlined />} onClick={exportExcel} disabled={!videos.length}>
              Xuất Excel
            </Button>
            {bulk && (
              <span style={{ color: "#888" }}>
                Đang lấy sản phẩm ({bulk.done}/{bulk.total})…{" "}
                <Progress percent={Math.round((bulk.done / bulk.total) * 100)} size="small" style={{ width: 150 }} />
              </span>
            )}
          </Space>
        </>
      )}

      <Table rowKey="videoId" columns={columns} dataSource={videos} loading={loading} size="small"
        scroll={{ x: 1500 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} video` }} />
    </Card>
  );
}
