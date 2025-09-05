import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/depth-seekers",
        destination: "/wieder-lebendig",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
