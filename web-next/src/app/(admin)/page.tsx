"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, Table, Card, Tag, Spin, Alert, Typography } from "antd";
import { api } from "../../lib/api";

const { Title, Paragraph } = Typography;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Scene {
  phan_canh: string;
  timestamp: string;
  co_canh: string;
  mo_ta_hinh_anh: string;
  kich_ban_am_thanh: string;
}
interface Storyboard {
  kich_ban_video: Scene[];
  giai_thich_diem_thanh_cong: { points: string[]; ky_thuat_quay_phim: string };
}

function parseTs(ts: string): [number, number] {
  const m = (ts || "").match(/(\d+)\D+(\d+)/);
  return m ? [+m[1], +m[2]] : [0, 0];
}

export default function StoryboardPage() {
  const [data, setData] = useState<Storyboard | null>(null);
  const [err, setErr] = useState<string>("");
  const [active, setActive] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    api.get("/storyboard").then(setData).catch((e) => setErr(String(e.message || e)));
  }, []);

  const rows: Scene[] = useMemo(() => data?.kich_ban_video || [], [data]);
  const segments = useMemo(
    () => rows.map((s, i) => { const [start, end] = parseTs(s.timestamp); return { start, end, i }; }),
    [rows]
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const seg = segments.find((s) => v.currentTime >= s.start && v.currentTime < s.end);
      if (seg) setActive(seg.i);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [segments]);

  if (err) return <Alert type="error" message="Không tải được storyboard" description={err} showIcon />;
  if (!data) return <div style={{ padding: 40, textAlign: "center" }}><Spin size="large" /></div>;

  const sa = data.giai_thich_diem_thanh_cong || { points: [], ky_thuat_quay_phim: "" };

  const columns = [
    {
      title: "Phân cảnh", dataIndex: "phan_canh", width: 200,
      render: (_: unknown, r: Scene) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.phan_canh}</div>
          <Tag color="cyan" style={{ marginTop: 6, fontFamily: "monospace" }}>{r.timestamp}</Tag>
        </div>
      ),
    },
    {
      title: "Mô tả hình ảnh", dataIndex: "mo_ta_hinh_anh",
      render: (_: unknown, r: Scene) => (
        <div>
          <Tag>📷 {r.co_canh}</Tag>
          <div style={{ color: "#666", marginTop: 6 }}>{r.mo_ta_hinh_anh}</div>
        </div>
      ),
    },
    { title: "Kịch bản âm thanh", dataIndex: "kich_ban_am_thanh" },
  ];

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <div style={{ width: 300, padding: 16, borderRight: "1px solid #f0f0f0" }}>
          <video
            ref={videoRef}
            src={`${API_URL}/storyboard/video`}
            controls
            playsInline
            style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "9/16", objectFit: "cover" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 320, padding: 16 }}>
          <Tabs
            items={[
              {
                key: "script", label: "Kịch bản video",
                children: (
                  <Table
                    rowKey={(r) => `${r.timestamp}-${r.phan_canh}`}
                    columns={columns}
                    dataSource={rows}
                    pagination={false}
                    size="middle"
                    rowClassName={(_, i) => (i === active ? "row-active" : "")}
                    onRow={(_, i) => ({
                      onClick: () => {
                        const [s] = parseTs(rows[i as number].timestamp);
                        if (videoRef.current) videoRef.current.currentTime = s + 0.1;
                      },
                    })}
                  />
                ),
              },
              {
                key: "success", label: "Giải thích điểm thành công",
                children: (
                  <div>
                    <Title level={5}>✨ Giải thích điểm thành công</Title>
                    <ol style={{ lineHeight: 1.8 }}>
                      {sa.points.map((p, i) => <li key={i}>{p}</li>)}
                    </ol>
                    <Title level={5} style={{ marginTop: 24 }}>🎬 Kỹ thuật quay phim</Title>
                    <Paragraph style={{ color: "#555" }}>{sa.ky_thuat_quay_phim}</Paragraph>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
      <style jsx global>{`.row-active > td { background: #e6fffb !important; }`}</style>
    </Card>
  );
}
