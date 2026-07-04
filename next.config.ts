import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in a parent dir
  // otherwise confuses Turbopack's root inference).
  turbopack: { root: __dirname },
  // Keep the server-only PDF/DOCX parsers out of the bundle so their Node
  // dependencies resolve correctly at runtime.
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
