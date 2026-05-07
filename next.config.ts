import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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

export default withNextIntl(nextConfig);
