import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // Prod (Coolify): mọi request /api/* được proxy sang container backend nội bộ
  // -> chỉ cần 1 domain video.infitech.vn, không dính CORS.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET; // vd http://api:8000
    if (!target) return [];
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
