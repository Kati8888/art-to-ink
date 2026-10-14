import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: false },
  async rewrites() { return { beforeFiles: [{ source: "/", destination: "/legacy.html" }] }; },
};

export default nextConfig;
