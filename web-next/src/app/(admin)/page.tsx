"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, Table, Card, Tag, Spin, Alert, Typography } from "antd";
import { CheckCircleFilled, LoadingOutlined } from "@ant-design/icons";
import { api } from "../../lib/api";

const { Title, Paragraph } = Typography;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STEPS = [
  "Trích xuất video",
  "Phân loại video",
  "Phân tích hình ảnh",
  "Phân tích âm thanh",
  "Nhận diện ngôn ngữ",
  "Phân tích cấu trúc kịch bản",
  "Khớp đặc điểm dữ liệu",
  "Tạo kết quả cuối cùng",
];

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
  const [videoId, setVideoId] = useState<string>();
  const [analyzing, setAnalyzing] = useState(false);
  const [idle, setIdle] = useState(false);
  const [step, setStep] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Tick dần các bước loading trong lúc phân tích (giống Kaloclip)
  useEffect(() => {
    if (!analyzing) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 5500);
    return () => clearInterval(t);
  }, [analyzing]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const vid = p.get("video_id");
    const vurl = p.get("video_url");
    if (vid) {
      setVideoId(vid); setErr("");
      // 1) Ưu tiên đọc bản ĐÃ LƯU — không phân tích lại, không tốn token
      api.get(`/analysis/${vid}`).then((cached) => {
        if (cached?.kich_ban_video?.length) { setData(cached); return; }
        // 2) Chưa có -> phân tích (hiện 8 bước).
        // Phân tích lâu (tải model + ASR + Claude) có thể vượt timeout proxy -> request lỗi
        // NHƯNG backend vẫn chạy tới cùng & lưu cache. Nên: vừa gọi /analyze, vừa POLL
        // /analysis/{id} tới khi có kết quả -> không báo lỗi oan.
        setAnalyzing(true);
        let done = false;
        const finish = (d: Storyboard) => {
          if (done) return; done = true;
          setData(d); setAnalyzing(false);
        };
        const trigger = () => api.post("/analyze", { video_id: vid, video_url: vurl || undefined,
          title: p.get("title") || "", source: p.get("source") || "" })
          .then((r) => { if (r?.kich_ban_video?.length) finish(r); })
          .catch(() => { /* nuốt lỗi timeout -> để polling lo */ });
        trigger();
        let tries = 0, idleSeen = 0, resubmits = 0;
        const poll = setInterval(() => {
          if (done) { clearInterval(poll); return; }
          if (++tries > 225) { // ~30 phút (chịu được lúc đông người xếp hàng)
            clearInterval(poll);
            if (!done) { setErr("Hệ thống đang bận (nhiều người phân tích cùng lúc). Video vẫn đang xử lý ở nền — mở lại video này sau ít phút sẽ có kết quả đã lưu."); setAnalyzing(false); }
            return;
          }
          api.get(`/analysis/${vid}`)
            .then((c) => {
              if (c?.kich_ban_video?.length) { clearInterval(poll); finish(c); return; }
              if (c?.error && !done) { clearInterval(poll); done = true; setErr(c.error); setAnalyzing(false); return; }
              // Job KHÔNG còn chạy (idle) mà chưa có kết quả -> có thể server vừa restart làm mất job.
              // Tự chạy lại (tối đa 3 lần) để không treo mãi.
              if (c?.status === "idle") {
                if (++idleSeen >= 2 && resubmits < 3) { idleSeen = 0; resubmits++; trigger(); }
              } else { idleSeen = 0; }
              // status "queued" | "running": đang xử lý, tiếp tục chờ.
            })
            .catch(() => {});
        }, 8000);
      }).catch((e) => setErr(String(e.message || e)));
    } else {
      // Chưa chọn video -> KHÔNG nạp dữ liệu mẫu, hiện màn hướng dẫn trống
      setIdle(true);
    }
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

  if (err) return <Alert type="error" message="Không phân tích được video" description={err} showIcon
    action={<a onClick={() => history.back()}>Quay lại</a>} />;
  if (analyzing) return (
    <Card style={{ maxWidth: 560, margin: "40px auto" }}>
      <Title level={5} style={{ marginBottom: 4 }}>Đang phân tích video</Title>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        {videoId ? <>Video <code>{videoId}</code> · </> : ""}có thể mất 1–3 phút, vui lòng giữ trang này.
      </Paragraph>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {STEPS.map((label, i) => {
          const done = i < step, activeStep = i === step;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12,
              opacity: done || activeStep ? 1 : 0.4 }}>
              <span style={{ width: 22, height: 22, display: "grid", placeItems: "center" }}>
                {done ? <CheckCircleFilled style={{ color: "#52c41a", fontSize: 18 }} />
                  : activeStep ? <LoadingOutlined style={{ color: "#B8912F", fontSize: 18 }} spin />
                  : <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #d9d9d9", display: "block" }} />}
              </span>
              <span style={{ fontWeight: activeStep ? 600 : 400 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
  if (idle && !data) return (
    <Card style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
      <Title level={5}>Chưa có video để phân tích</Title>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Vào tab <b>Video Affiliate</b> rồi bấm vào <b>ID video</b> để phân tích,
        hoặc tab <b>Upload video</b> để tải video đối thủ lên và bấm “Phân tích”.
        Kết quả kịch bản + giải thích điểm thành công sẽ hiện ở đây.
      </Paragraph>
    </Card>
  );
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
            src={videoId ? `${API_URL}/analyze/${videoId}/video` : `${API_URL}/storyboard/video`}
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
                    <div className="pt-list">
                      {sa.points.map((p, i) => (
                        <div className="pt-row" key={i}>
                          <span className="pt-num">{i + 1}</span>
                          <span className="pt-text">{p}</span>
                        </div>
                      ))}
                    </div>
                    <Title level={5} style={{ marginTop: 24 }}>🎬 Kỹ thuật quay phim</Title>
                    <Paragraph style={{ color: "#555" }}>{sa.ky_thuat_quay_phim}</Paragraph>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
      <style jsx global>{`
        .row-active > td { background: #e6fffb !important; }
        .pt-list { margin: 4px 0 8px; }
        .pt-row {
          display: flex; gap: 12px; align-items: flex-start;
          padding: 12px 4px; border-bottom: 1px solid #f0f0f0; line-height: 1.6;
        }
        .pt-row:last-child { border-bottom: 0; }
        .pt-num {
          flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
          background: #e6fffb; color: #08979c; font-weight: 700; font-size: 13px;
          display: grid; place-items: center;
        }
        .pt-text { color: #333; }
      `}</style>
    </Card>
  );
}
