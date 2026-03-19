import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow react-pdf worker to be loaded
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
