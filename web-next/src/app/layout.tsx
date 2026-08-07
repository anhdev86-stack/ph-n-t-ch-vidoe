import '@ant-design/v5-patch-for-react-19';
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["vietnamese"],
});

export const metadata: Metadata = {
  title: "Infi Tech - Affiliate",
  description: "Infi Tech - Affiliate | Đơn hàng Affiliate TikTok Shop",
};

// App chạy động hoàn toàn (auth-gated, không cần SEO tĩnh). Tắt prerender tĩnh
// để tránh crash "Invalid URL" khi build (NextAuth dựng URL lúc export /login).
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${roboto.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
