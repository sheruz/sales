import type { NextConfig } from "next";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
require("./scripts/load-env");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Paddle.js checkout overlay (cdn + sandbox/live buy frames)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.paddle.com https://*.paddle.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.paddle.com https://*.paddle.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.paddle.com https://*.paddle.com",
      "connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.paddle.com",
      "frame-src 'self' https://*.paddle.com https://cdn.paddle.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];


const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Static Delvix Studio marketing HTML (not React) — bypasses app layout
        { source: "/", destination: "/landing.html" },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
