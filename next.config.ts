import type { NextConfig } from "next";
import { createRequire } from "module";

// Load .env + build DATABASE_URL from POSTGRES_* before build collects pages
const require = createRequire(import.meta.url);
require("./scripts/load-env");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
