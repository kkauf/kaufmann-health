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
      // Match endpoints (moved Sept 24, 2025)
      {
        source: "/api/match/:uuid/select",
        destination: "/api/public/match/:uuid/select",
      },
      {
        source: "/api/match/:uuid/respond",
        destination: "/api/public/match/:uuid/respond",
      },
      // Therapist endpoints (moved Sept 24, 2025)
      {
        source: "/api/therapists/opt-out",
        destination: "/api/public/therapists/opt-out",
      },
      {
        source: "/api/therapists/:id/documents",
        destination: "/api/admin/therapists/:id/documents",
      },
      {
        source: "/api/therapists/:id/profile",
        destination: "/api/admin/therapists/:id/profile",
      },
      // Lead endpoints (moved Sept 24, 2025)
      {
        source: "/api/leads",
        destination: "/api/public/leads",
      },
      {
        source: "/api/leads/confirm",
        destination: "/api/public/leads/confirm",
      },
      {
        source: "/api/leads/resend-confirmation",
        destination: "/api/public/leads/resend-confirmation",
      },
      {
        source: "/api/leads/:id/preferences",
        destination: "/api/public/leads/:id/preferences",
      },
      // Other public endpoints (moved Sept 24, 2025)
      {
        source: "/api/events",
        destination: "/api/public/events",
      },
      {
        source: "/api/feedback",
        destination: "/api/public/feedback",
      },
      {
        source: "/api/images/therapist-profiles/:path*",
        destination: "/api/public/images/therapist-profiles/:path*",
      },
    ];
  },
};

export default nextConfig;
