"use client";

import React, { useEffect, useState } from "react";
import { Card, Row, Col, Tag, Alert, Spin, Button, Typography, Empty } from "antd";
import { EyeOutlined, ShoppingOutlined, ReloadOutlined } from "@ant-design/icons";
import { api } from "../../../lib/api";

const { Text } = Typography;

interface Video {
  id?: string; title: string; cover?: string; video_url?: string;
  creator?: string; product?: string; views?: number; sales?: number; gmv?: string;
}

function num(n?: number) {
  if (n == null) return "—";
  return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);
}

export default function VideoAffPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true); setErr("");
    api.get("/videos")
      .then((res) => {
        if (res.error) { setErr(res.error); return; }
        setVideos(res.videos || []);
        if (res.raw_sample) console.log("raw_sample (gửi lại để chốt mapping):", res.raw_sample);
      })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <Card
      title="Video Affiliate gắn sản phẩm shop"
      extra={<Button icon={<ReloadOutlined />} onClick={load}>Tải lại</Button>}
    >
      {err && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          message="Chưa lấy được video"
          description={<>{err}<br /><Text type="secondary">Vào tab “Kết nối TikTok” để ủy quyền shop, hoặc đặt TTS_APP_KEY/APP_SECRET/ACCESS_TOKEN.</Text></>}
        />
      )}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><Spin size="large" /></div>
      ) : videos.length === 0 && !err ? (
        <Empty description="Chưa có video affiliate nào." />
      ) : (
        <Row gutter={[16, 16]}>
          {videos.map((v, i) => (
            <Col key={v.id || i} xs={12} sm={8} md={6} lg={4}>
              <Card
                hoverable
                size="small"
                cover={
                  v.cover
                    ? <img alt="" src={v.cover} style={{ aspectRatio: "9/16", objectFit: "cover" }} />
                    : <div style={{ aspectRatio: "9/16", background: "#f0f0f0", display: "grid", placeItems: "center", color: "#bbb" }}>▶</div>
                }
                onClick={() => v.video_url && window.open(v.video_url, "_blank")}
              >
                <div style={{ fontSize: 13, fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {v.title || "(không tiêu đề)"}
                </div>
                {v.creator && <div style={{ color: "#13c2c2", fontSize: 12 }}>@{v.creator}</div>}
                {v.product && <Tag style={{ marginTop: 6, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{v.product}</Tag>}
                <div style={{ marginTop: 6, display: "flex", gap: 12, color: "#888", fontSize: 12 }}>
                  <span><EyeOutlined /> {num(v.views)}</span>
                  <span><ShoppingOutlined /> {num(v.sales)}</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Card>
  );
}
