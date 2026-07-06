import type { NextConfig } from "next";

// Content-Security-Policy. This app only talks to its own origin (/api/*),
// self-hosts fonts via next/font, and renders icons as inline SVG — so a
// 'self'-based policy is safe. 'unsafe-inline' on script/style is required for
// Next.js's inline hydration bootstrap and next-themes' anti-FOUC script;
// 'unsafe-eval' is dev-only (Turbopack/React Refresh) and dropped in prod.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in a parent dir
  // otherwise confuses Turbopack's root inference).
  turbopack: { root: __dirname },
  // Keep the server-only PDF/DOCX parsers out of the bundle so their Node
  // dependencies resolve correctly at runtime.
  serverExternalPackages: ["unpdf", "mammoth"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
