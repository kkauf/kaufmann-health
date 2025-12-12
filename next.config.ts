import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: false,
    // Allow warnings without failing the build
    dirs: ['src'], // Only run ESLint on src directory
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000, // 1 year
    deviceSizes: [640, 750, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        ],
      },
    ];
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
      {
        source: "/api/match/:uuid/resend",
        destination: "/api/public/match/:uuid/resend",
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
