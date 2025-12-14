import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: process.env.NODE_ENV === "development" ? { position: "bottom-right" } : false
};

export default nextConfig;
