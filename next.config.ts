import type { NextConfig } from "next";

// Static export for GitHub Pages. All data stays on the phone.
// NEXT_PUBLIC_BASE_PATH is the repo path (e.g. /workout-log), set by the Pages workflow.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const nextConfig: NextConfig = { output: "export", trailingSlash: true, basePath, images: { unoptimized: true } };
export default nextConfig;
