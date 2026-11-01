import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side only — never expose ingest logic to the browser bundle
  serverExternalPackages: ["csv-parse"],
};

export default nextConfig;
