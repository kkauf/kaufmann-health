import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NoCookieToast from "@/components/NoCookieToast";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import Script from "next/script";
import { COOKIES_ENABLED } from "@/lib/config";
import CookieBanner from "@/components/CookieBanner";
import GtagLoader from "@/components/GtagLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kaufmann-health.de"),
  title:
    "Therapeut:innen-Empfehlung – Sorgfältig geprüfte Therapeut:innen in deiner Nähe | Kaufmann Health",
  description:
    "Handverlesene Therapeut:innen-Empfehlungen für körperorientierte Psychotherapie (NARM, Hakomi, Somatic Experiencing). Direkter Kontakt, transparente Auswahl, ohne Wartezeit.",
  keywords: [
    "Therapeut:innen finden",
    "Therapeut:innen-Empfehlung",
    "Körperorientierte Psychotherapie",
    "NARM",
    "Hakomi",
    "Somatic Experiencing",
  ],
  openGraph: {
    title: "Therapeut:innen-Empfehlung | Kaufmann Health",
    description:
      "Handverlesene Empfehlungen und Kontaktdaten sorgfältig geprüfter Therapeut:innen (NARM, Hakomi, Somatic Experiencing).",
    url: "https://kaufmann-health.de/",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: "/images/hero.jpg",
        width: 1200,
        height: 630,
        alt: "Kaufmann Health – Körperorientierte Psychotherapie",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Therapeut:innen-Empfehlung | Kaufmann Health",
    description:
      "Handverlesene Empfehlungen sorgfältig geprüfter Therapeut:innen für körperorientierte Psychotherapie.",
    images: ["/images/hero.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/logos/Health Logos - tree/Tree.svg", type: "image/svg+xml" },
      { url: "/logos/Health Logos - tree/Tree_small.png", type: "image/png" },
    ],
    apple: [
      { url: "/logos/Health Logos - tree/Tree_large.png", type: "image/png" },
    ],
    shortcut: [
      { url: "/logos/Health Logos - tree/Tree_small.png", type: "image/png" },
    ],
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ? (
          <>
            <Script id="gtag-stub" strategy="beforeInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'default', {
                  'ad_storage': 'denied',
                  'analytics_storage': 'denied',
                  'ad_user_data': 'denied',
                  'ad_personalization': 'denied'
                });
                // Queue init and config so any early events are ordered correctly
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}', {
                  'allow_ad_personalization_signals': false,
                  ${COOKIES_ENABLED ? "'conversion_linker': true, 'url_passthrough': true" : "'url_passthrough': true"}
                });
              `}
            </Script>
            <GtagLoader />
          </>
        ) : null}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-gray-900 focus:px-3 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900">
          Zum Inhalt springen
        </a>
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
        <AnalyticsProvider />
        {!COOKIES_ENABLED && <NoCookieToast />}
        {COOKIES_ENABLED && <CookieBanner />}
      </body>
    </html>
  );
}
