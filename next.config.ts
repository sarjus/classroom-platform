import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "github.com" },
    ],
  },
  // Silence build errors from workers (they import server-only modules)
  serverExternalPackages: ["bcryptjs"],
  experimental: {
  },
};

export default nextConfig;
