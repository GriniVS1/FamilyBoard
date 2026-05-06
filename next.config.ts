import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "gaxios",
    "gtoken",
    "googleapis-common",
    "@prisma/client",
    ".prisma/client",
    "bcryptjs",
  ],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
