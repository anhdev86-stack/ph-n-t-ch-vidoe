import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // swcMinify đã là mặc định từ Next 13+ và bị loại bỏ ở Next 15 (gây warning) → bỏ đi
  compress: true,
};

export default nextConfig;
