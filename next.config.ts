import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs"],
  // Produce a self-contained build in .next/standalone (server.js + only the needed
  // node_modules) so we can ship the build alone — no source code, no npm install on the shop PC.
  output: "standalone",
};

export default nextConfig;
