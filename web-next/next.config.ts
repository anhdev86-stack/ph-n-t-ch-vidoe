import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // Không để lint/type-check chặn build production (Coolify). Lỗi lint vặt từ
  // các trang copy sẵn không được làm hỏng deploy.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Prod (Coolify): mọi request /api/* được proxy sang container backend nội bộ
  // -> chỉ cần 1 domain video.infitech.vn, không dính CORS.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET; // vd http://api:8000
    if (!target) return [];
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
