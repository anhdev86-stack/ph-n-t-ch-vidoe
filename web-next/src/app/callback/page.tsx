"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Typography, Spin, Result } from "antd";
import { parseTikTokCallback } from "../../utils/tiktokAuth";
import { api } from "../../lib/api";

const { Text } = Typography;

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { code, state } = parseTikTokCallback(window.location.href);
        if (!code) { setStatus("error"); setMsg("Không tìm thấy mã ủy quyền (code)."); return; }

        // Chống CSRF: state phải khớp cái đã lưu khi bấm kết nối
        const savedState = localStorage.getItem("tiktok_auth_state");
        if (!state || state !== savedState) {
          setStatus("error"); setMsg("Xác thực state thất bại, thử lại."); return;
        }

        const pendingRaw = localStorage.getItem("pendingTikTokConnect");
        if (!pendingRaw) { setStatus("error"); setMsg("Thiếu thông tin kết nối đang chờ."); return; }
        const p = JSON.parse(pendingRaw);

        const res = await api.post("/tiktok/connect", {
          authCode: code,
          appKey: p.appKey,
          appSecret: p.appSecret,
          serviceId: p.serviceId || "",
          shopName: p.shopName || "",
          market: p.market || "global",
        });

        // dọn localStorage
        ["tiktok_auth_state", "tiktok_auth_timestamp", "pendingTikTokConnect"].forEach((k) =>
          localStorage.removeItem(k)
        );

        if (res.error || !res.connected) {
          router.replace("/connect?authorized=0");
        } else {
          router.replace("/connect?authorized=1");
        }
      } catch (e) {
        setStatus("error");
        setMsg(String((e as Error).message || e));
      }
    })();
  }, [router]);

  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <Result status="error" title="Kết nối TikTok thất bại" subTitle={msg}
          extra={<a href="/connect">Quay lại trang Kết nối</a>} />
      </div>
    );
  }
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", gap: 16 }}>
      <Spin size="large" />
      <Text type="secondary">Đang xử lý ủy quyền TikTok Shop…</Text>
    </div>
  );
}
