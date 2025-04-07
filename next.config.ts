import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'taivas.komakallio.fi',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
