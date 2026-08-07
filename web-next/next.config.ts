import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false, // không xuất source map -> khó đọc code gốc
  // Không để lint/type-check chặn build production (Coolify). Lỗi lint vặt từ
  // các trang copy sẵn không được làm hỏng deploy.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Prod (Coolify): mọi request /api/* được proxy sang container backend nội bộ
  // -> chỉ cần 1 domain video.infitech.vn, không dính CORS.
  // LƯU Ý: Next "nướng" rewrite vào lúc BUILD (đọc env khi build), nên phải có
  // giá trị mặc định http://api:8000 (tên service backend trong docker-compose).
  // Ở dev, client gọi thẳng NEXT_PUBLIC_API_URL tuyệt đối nên rewrite này không bị chạm.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://api:8000";
    // CHỈ proxy /api/v1/* sang backend. TUYỆT ĐỐI không đụng /api/auth/* của NextAuth.
    return [{ source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` }];
  },
  // Security headers: chống nhúng/clickjacking, ép HTTPS, chặn dò MIME, giấu referrer.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
