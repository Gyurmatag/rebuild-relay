import type { NextConfig } from "next";

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

// Makes Cloudflare bindings (D1, R2, vars, secrets) available via
// `getCloudflareContext()` during `next dev`, matching the deployed runtime.
initOpenNextCloudflareForDev();
