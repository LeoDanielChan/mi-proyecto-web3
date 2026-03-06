import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws"],
  // allowedDevOrigins solo aplica en desarrollo local y no debe ir a producción
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: [
      "192.168.68.53",
      "192.168.*.*",
      "10.*.*.*",
      "172.16.*.*",
    ],
  }),
};

export default nextConfig;
