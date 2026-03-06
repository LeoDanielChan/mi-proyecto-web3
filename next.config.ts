import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws"],
  allowedDevOrigins: [
    "192.168.68.53",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
  ],
};

export default nextConfig;
