import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year
    deviceSizes: [640, 750, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async redirects() {
    return [
      {
        source: "/depth-seekers",
        destination: "/wieder-lebendig",
        permanent: true,
      },
      {
        source: "/preferences",
        destination: "/fragebogen",
        permanent: true,
      },
      {
        source: "/fragebogen/confirmed",
        destination: "/fragebogen",
        permanent: true,
      },
      {
        source: "/therapie/koerpertherapie",
        destination: "/therapie",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/match/:uuid/select",
        destination: "/api/public/match/:uuid/select",
      },
      {
        source: "/api/match/:uuid/respond",
        destination: "/api/public/match/:uuid/respond",
      },
    ];
  },
};

export default nextConfig;
