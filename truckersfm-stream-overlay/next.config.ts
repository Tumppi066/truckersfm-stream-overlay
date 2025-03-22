import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_TYPE === 'local' ? undefined : 'export',
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;