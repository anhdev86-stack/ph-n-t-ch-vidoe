"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card, Row, Col, Select, DatePicker, Button, Table, Statistic, Alert, Typography,
  Popover, Spin, Progress, Space, message, Modal,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined, DownloadOutlined, PlayCircleOutlined, BulbOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import CommonAnalyze from "../../../components/CommonAnalyze";

const { RangePicker } = DatePicker;
const { Text } = Typography;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Shop { id: string; shop_name: string; seller_name: string }
interface Video {
  videoId: string; videoLink: string; title: string; username: string;
  gmv: number; currency: string; orders: number; itemsSold: number;
  views: number; ctr: number; cvr: number; gpm: number; postedAt: string;
}
interface Totals { count: number; gmv: number; views: number; orders: number; ctr: number; cvr: number }
type Product = { name: string; gmv: number; unitsSold: number };
type ProdState = Product[] | "loading" | undefined;
interface Insights {
  tong_quan: string;
  cong_thuc_thang: { yeu_to: string; mo_ta: string; bang_chung?: string }[];
  hook_hieu_qua: string[];
  san_pham_nen_day: { ten: string; ly_do: string }[];
  goi_y_dinh_dang: string[];
  canh_bao?: string[];
}

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
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [productFilter, setProductFilter] = useState<string>();
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const router = useRouter();

  // Danh sách sản phẩm (gom từ sản phẩm đã tải của các video) để làm bộ lọc
  const productOptions = useMemo(() => {
    const names = new Set<string>();
    Object.values(products).forEach((p) => {
      if (Array.isArray(p)) p.forEach((x) => { if (x?.name) names.add(x.name); });
    });
    return Array.from(names).sort().map((n) => ({ value: n, label: n }));
  }, [products]);

  // Video sau khi lọc theo sản phẩm (client-side, dùng sản phẩm đã tải)
  const filteredVideos = useMemo(() => {
    if (!productFilter) return videos;
    return videos.filter((v) => {
      const p = products[v.videoId];
      return Array.isArray(p) && p.some((x) => x.name === productFilter);
    });
  }, [videos, products, productFilter]);

  const selectedItems = videos
    .filter((v) => selectedKeys.includes(v.videoId))
    .map((v) => ({ video_id: v.videoId, source: "tiktok", video_url: v.videoLink, title: v.title }));

  useEffect(() => {
    api.get("/tiktok/shops").then((r) => {
      setShops(r.shops || []);
      if (r.shops?.[0]) setShopId((cur) => cur || r.shops[0].id);
    }).catch(() => {});
  }, []);

  // Khôi phục kết quả lần trước (không mất khi F5 / đổi tab)
  const CACHE_KEY = "videoAffCache_v1";
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c && Array.isArray(c.videos) && c.videos.length) {
        setVideos(c.videos);
        setTotals(c.totals || null);
        setProducts(c.products || {});
        if (c.shopId) setShopId(c.shopId);
        if (c.range?.length === 2) setRange([dayjs(c.range[0]), dayjs(c.range[1])]);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tự lưu mỗi khi dữ liệu đổi
  useEffect(() => {
    if (!videos.length) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        videos, totals, products, shopId,
        range: [range[0]?.toISOString?.(), range[1]?.toISOString?.()],
      }));
    } catch {}
  }, [videos, totals, products, shopId, range]);

  const qsDates = () => {
    const [s, e] = range;
    return { start_date: s.format("YYYY-MM-DD"), end_date: e.format("YYYY-MM-DD"),
             ...(shopId ? { shop_id: shopId } : {}) };
  };

  const analyze = async () => {
    setLoading(true); setErr(""); setVideos([]); setTotals(null); setProducts({}); setProductFilter(undefined);
    try {
      const r = await api.get(`/videos?${new URLSearchParams({ ...qsDates(), sort_field: "gmv" })}`);
      if (r.error) { setErr(r.error); return; }
      const list: Video[] = r.videos || [];
      setVideos(list); setTotals(r.totals || null);
      if (!list.length) msg.info("Không có video trong khoảng ngày này. Thử mở rộng khoảng ngày (vd 30 ngày gần nhất).", 6);
      else if (r.truncated) msg.warning(`Range lớn — mới lấy ${list.length} video (một phần). Thu hẹp khoảng ngày để lấy đủ.`, 6);
      autoLoadProducts(list); // tự lấy sản phẩm song song, không cần bấm
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  };

  // Tự đổ sản phẩm cho video có đơn (chạy nền). Tối ưu MƯỢT khi nhiều dữ liệu:
  // gom kết quả vào buffer, chỉ vẽ lại ~2 lần/giây thay vì set state theo từng video
  // (tránh "bão re-render" làm giật bảng khi có hàng trăm video).
  const autoLoadProducts = async (list: Video[]) => {
    const targets = list.filter((v) => v.orders > 0);
    if (!targets.length) return;
    setBulk({ done: 0, total: targets.length });
    setProducts((p) => {
      const n = { ...p };
      targets.forEach((v) => { if (n[v.videoId] === undefined) n[v.videoId] = "loading"; });
      return n;
    });
    const buf: Record<string, Product[]> = {};
    let done = 0;
    const timer = setInterval(() => {
      setProducts((p) => ({ ...p, ...buf }));
      setBulk({ done, total: targets.length });
    }, 500);
    await pool(targets, async (v) => {
      try {
        const r = await api.get(`/videos/${v.videoId}/products?${new URLSearchParams(qsDates())}`);
        buf[v.videoId] = r.products || [];
      } catch { buf[v.videoId] = []; }
      done++;
    }, 6);
    clearInterval(timer);
    setProducts((p) => ({ ...p, ...buf })); // flush cuối
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
    const rows = filteredVideos.map((v) => {
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
    msg.success(`Đã xuất ${filteredVideos.length} video`);
  };

  // Trợ lý phân tích thông minh: gửi top video (theo GMV) -> AI rút công thức content
  const runInsights = async () => {
    const top = [...filteredVideos].sort((a, b) => b.gmv - a.gmv).slice(0, 40).map((v) => {
      const p = products[v.videoId];
      return {
        video_id: v.videoId, title: v.title, creator: v.username,
        product: Array.isArray(p) ? p.map((x) => x.name).join(" · ") : "",
        gmv: v.gmv, orders: v.orders, views: v.views, ctr: v.ctr, cvr: v.cvr, gpm: v.gpm,
      };
    });
    if (!top.length) { msg.info("Chưa có video. Bấm 'Lấy video' trước."); return; }
    setInsightsOpen(true); setInsights(null); setInsightsLoading(true);
    try {
      const shopName = shops.find((s) => s.id === shopId)?.shop_name || "";
      await api.post("/insights", { videos: top, shop_name: shopName });
      for (let i = 0; i < 45; i++) {                 // poll tối đa ~3 phút
        await new Promise((r) => setTimeout(r, 4000));
        const r = await api.get("/insights");
        if (r?.status === "done") { setInsights(r.result); break; }
        if (r?.status === "error") { msg.error("Phân tích lỗi: " + r.error); break; }
      }
    } catch (e) { msg.error(String((e as Error).message || e)); }
    finally { setInsightsLoading(false); }
  };

  const clip = (t: string) => (
    <div title={t} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" }}>{t}</div>
  );

  const columns: ColumnsType<Video> = [
    { title: "ID video", dataIndex: "videoId", width: 180, ellipsis: true,
      render: (id: string, v) => (
        <a title="Phân tích video này"
          onClick={() => router.push(`/?video_id=${id}&video_url=${encodeURIComponent(v.videoLink || "")}&source=tiktok&title=${encodeURIComponent(v.title || "")}`)}>
          {id}
        </a>
      ) },
    { title: "Xem", dataIndex: "videoLink", width: 72, render: (_u: string, v) =>
        v.videoId ? (
          <a onClick={() => setPlaying({ id: v.videoId, url: v.videoLink || "" })}
            title="Phát video qua máy chủ (xem được cả video giỏ hàng)">
            <PlayCircleOutlined /> Xem
          </a>
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
        <Col><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={analyze}>Lấy video</Button></Col>
      </Row>

      {err && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không lấy được video"
        description={<>{err}<br /><Text type="secondary">Chọn shop đã kết nối ở tab “Kết nối TikTok”.</Text></>} />}

      {videos.length > 0 && (
        <>
          {totals && (<Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}><Card><Statistic title="Tổng video" value={totals.count} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="GMV" value={numf(totals.gmv)} suffix="₫" /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="Lượt xem" value={numf(totals.views)} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="CTR / CVR" value={`${totals.ctr}% / ${totals.cvr}%`} /></Card></Col>
          </Row>)}
          <Space style={{ marginBottom: 12 }} wrap>
            <Select allowClear showSearch style={{ minWidth: 260 }} value={productFilter}
              onChange={setProductFilter} options={productOptions} optionFilterProp="label"
              placeholder="Lọc theo sản phẩm"
              notFoundContent={bulk ? "Đang tải sản phẩm…" : "Chưa có sản phẩm"} />
            {productFilter && <Text type="secondary">{filteredVideos.length} video có sản phẩm này</Text>}
            <Button type="primary" ghost icon={<DownloadOutlined />} onClick={exportExcel} disabled={!filteredVideos.length}>
              Xuất Excel
            </Button>
            <Button type="primary" icon={<BulbOutlined />} onClick={runInsights}
              loading={insightsLoading} disabled={!filteredVideos.length}
              style={{ background: "#B8912F", borderColor: "#B8912F" }}>
              Rút công thức content (AI)
            </Button>
            <CommonAnalyze items={selectedItems} />
            {bulk && (
              <span style={{ color: "#888" }}>
                Đang lấy sản phẩm ({bulk.done}/{bulk.total})…{" "}
                <Progress percent={Math.round((bulk.done / bulk.total) * 100)} size="small" style={{ width: 150 }} />
              </span>
            )}
          </Space>
        </>
      )}

      <Table rowKey="videoId" columns={columns} dataSource={filteredVideos} loading={loading} size="small"
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, preserveSelectedRowKeys: true }}
        sticky scroll={{ x: 1500, y: 560 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true,
          pageSizeOptions: [20, 50, 100], showTotal: (t) => `${t} video` }} />

      <Modal open={!!playing} onCancel={() => setPlaying(null)} footer={null} width={360}
        destroyOnClose title="Xem video" styles={{ body: { paddingTop: 8 } }}>
        {playing && (
          <video
            key={playing.id}
            src={`${API_URL}/tiktok-video/${playing.id}?url=${encodeURIComponent(playing.url)}`}
            controls autoPlay playsInline
            onError={() => msg.error("Không tải được video. Thử lại sau ít giây hoặc mở trên TikTok.")}
            style={{ width: "100%", borderRadius: 8, background: "#000", aspectRatio: "9/16", objectFit: "contain" }}
          />
        )}
        <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
          Phát qua máy chủ — xem được cả video <b>gắn giỏ hàng</b>. Lần đầu tải mất vài giây.{" "}
          {playing?.url && <a href={playing.url} target="_blank" rel="noopener">Mở trên TikTok ↗</a>}
        </div>
      </Modal>

      <Modal open={insightsOpen} onCancel={() => setInsightsOpen(false)} footer={null} width={760}
        title={<span><BulbOutlined style={{ color: "#B8912F" }} /> Công thức content thắng (AI phân tích {Math.min(40, filteredVideos.length)} video top)</span>}>
        {insightsLoading && !insights && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin /> <div style={{ marginTop: 12, color: "#888" }}>AI đang đọc số liệu + storyboard để rút công thức… (~30-90 giây)</div>
          </div>
        )}
        {insights && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#faf6ec", border: "1px solid #ecdca9", borderRadius: 8, padding: 12 }}>
              <b>Tổng quan:</b> {insights.tong_quan}
            </div>
            <div>
              <b>🎯 Công thức thắng</b>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.cong_thuc_thang?.map((c, i) => (
                  <div key={i} style={{ borderLeft: "3px solid #B8912F", paddingLeft: 10 }}>
                    <div><b>{c.yeu_to}:</b> {c.mo_ta}</div>
                    {c.bang_chung && <div style={{ color: "#888", fontSize: 12 }}>↳ Bằng chứng: {c.bang_chung}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <b>🪝 Hook hiệu quả nên dùng</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {insights.hook_hieu_qua?.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
            <div>
              <b>📦 Sản phẩm nên đẩy</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {insights.san_pham_nen_day?.map((p, i) => <li key={i}><b>{p.ten}</b> — {p.ly_do}</li>)}
              </ul>
            </div>
            <div>
              <b>🎬 Gợi ý định dạng / độ dài / CTA</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {insights.goi_y_dinh_dang?.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
            {insights.canh_bao && insights.canh_bao.length > 0 && (
              <div>
                <b>⚠️ Nên tránh</b>
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  {insights.canh_bao.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
