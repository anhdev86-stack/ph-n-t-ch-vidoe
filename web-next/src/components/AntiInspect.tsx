"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

/**
 * Rào cản chống xem/soi code (deter, KHÔNG phải bảo mật tuyệt đối — code frontend
 * luôn tải về máy client). Chặn F12 / chuột phải / Ctrl+U / Ctrl+S và phát hiện
 * DevTools mở -> tự đăng xuất & đẩy khỏi web.
 *
 * Chỉ bật ở production; tắt được bằng env NEXT_PUBLIC_ANTI_INSPECT="off".
 */
export default function AntiInspect() {
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_ANTI_INSPECT !== "off";
    if (enabled === false) return;
    if (typeof window === "undefined") return;

    let kicked = false;
    const kick = () => {
      if (kicked) return;
      kicked = true;
      try { document.documentElement.innerHTML = ""; } catch {}
      // Xoá phiên rồi đẩy khỏi web
      try { signOut({ callbackUrl: "/login" }); } catch {}
      try { window.location.replace("about:blank"); } catch {}
    };

    // 1) Chặn chuột phải
    const onContext = (e: MouseEvent) => { e.preventDefault(); };

    // 2) Chặn phím mở devtools / xem nguồn / lưu trang
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      const block =
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "I" || k === "J" || k === "C")) ||
        ((e.ctrlKey || e.metaKey) && (k === "U" || k === "S"));
      if (block) { e.preventDefault(); e.stopPropagation(); kick(); }
    };

    // 3) Phát hiện DevTools mở bằng độ trễ của lệnh debugger (chỉ dừng khi devtools mở)
    let hits = 0;
    const detect = () => {
      const t0 = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const dt = performance.now() - t0;
      if (dt > 120) {
        hits += 1;
        if (hits >= 2) kick();
      } else {
        hits = 0;
      }
    };
    const timer = window.setInterval(detect, 1500);

    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey, true);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  return null;
}
