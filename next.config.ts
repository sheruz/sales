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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://cdn.paddle.com https://*.paddle.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.paddle.com https://*.paddle.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.paddle.com https://*.paddle.com",
      "connect-src 'self' https: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net https://*.paddle.com",
      "frame-src 'self' https://*.paddle.com https://cdn.paddle.com https://www.facebook.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];


const nextConfig: NextConfig = {
  images: {
    // Marketing mockups are local SVGs; allow them through next/image.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async redirects() {
    return [
      { source: "/services/web-apps", destination: "/services/web-applications", permanent: true },
      { source: "/services/erp-crm", destination: "/services/erp-development", permanent: true },
      { source: "/services/ai-integrations", destination: "/ai/ai-integrations", permanent: true },
      { source: "/services/automation", destination: "/services/automation-integrations", permanent: true },
      { source: "/industries/logistics", destination: "/industries/logistics-trucking", permanent: true },
      { source: "/industries/clinics", destination: "/industries/healthcare-clinics", permanent: true },
      { source: "/industries/construction", destination: "/industries/construction-trades", permanent: true },
      { source: "/industries/retail", destination: "/industries/retail-inventory", permanent: true },
    ];
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
