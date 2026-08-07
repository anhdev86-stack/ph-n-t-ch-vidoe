"use client";

import { SessionProvider } from "next-auth/react";
import { ConfigProvider } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import AntiInspect from "../components/AntiInspect";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AntiInspect />
      <AntdRegistry>
        <ConfigProvider
          theme={{
            token: {
              // Nhận diện INFI TECH: vàng ánh kim + đen
              colorPrimary: "#B8912F",
              colorLink: "#B8912F",
              colorLinkHover: "#D4AF37",
              colorInfo: "#B8912F",
              borderRadius: 8,
            },
            components: {
              Layout: { headerBg: "#ffffff" },
              Menu: {
                itemSelectedColor: "#B8912F",
                itemSelectedBg: "#F7F1DE",
              },
            },
          }}
        >
          {children}
        </ConfigProvider>
      </AntdRegistry>
    </SessionProvider>
  );
} 