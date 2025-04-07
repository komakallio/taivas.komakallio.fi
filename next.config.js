/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'taivas.komakallio.fi',
        pathname: '/images/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/images/:path*',
        destination: '/var/www/allsky/images/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 