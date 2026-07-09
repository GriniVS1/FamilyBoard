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
    // Keep ws unbundled: webpack breaks its graceful optional-require of the
    // native bufferutil accelerator, leaving a stub whose .mask throws. As an
    // external, ws resolves at runtime and falls back to pure-JS masking.
    "ws",
  ],
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
