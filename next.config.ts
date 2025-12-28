import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce CPU usage during compilation
  webpack: (config, { dev }) => {
    if (dev) {
      // Limit parallel processing to reduce CPU spikes
      config.parallelism = 2; // Default is 100, we limit to 2
    }
    return config;
  },
};

export default nextConfig;
