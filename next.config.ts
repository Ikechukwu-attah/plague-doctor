import path from "node:path";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Production CSP (UI-15.3, UI-16.4). 'unsafe-inline' is required for Next's
// inline bootstrap scripts and styles; dev additionally needs 'unsafe-eval'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Server-side only — never expose ingest logic to the browser bundle
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["csv-parse"],
  // The API routes read data/normalized/** via a runtime path (process.cwd()),
  // which file tracing cannot see. Bundle it explicitly so deployed functions have it.
  outputFileTracingIncludes: {
    "/api/**": ["./data/normalized/**/*"],
  },
  // Task 15.7: ~9 KB of CSS is inlined instead of two render-blocking requests (style-src allows inline).
  experimental: { inlineCss: true },
  async headers() {
    if (!isProd) return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
