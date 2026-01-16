import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NoCookieToast from "@/components/NoCookieToast";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import TestMode from "@/components/TestMode";
import Script from "next/script";
import { COOKIES_ENABLED } from "@/lib/config";
import CookieBanner from "@/components/CookieBanner";
import GtagLoader from "@/components/GtagLoader";
import { ErrorTracker } from "@/components/ErrorTracker";
import ClarityLoader from "@/components/ClarityLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.kaufmann-health.de"),
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
    url: "https://www.kaufmann-health.de/",
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
        {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ? (
          <Script id="clarity-init" strategy="afterInteractive">
            {`
              // Skip Clarity for test sessions, localhost, and staging
              function shouldExcludeRecording() {
                // Check kh_test cookie
                if (document.cookie.split(';').some(c => c.trim().startsWith('kh_test=1'))) return true;
                // Check localhost
                var h = window.location.hostname;
                if (h === 'localhost' || h === '127.0.0.1') return true;
                // Check staging/preview (Vercel previews, non-production domains)
                if (h.includes('.vercel.app') || h.includes('staging') || h.includes('preview')) return true;
                return false;
              }
              
              if (shouldExcludeRecording()) {
                console.log('[Clarity] Excluded: test/localhost/staging');
              } else {
              // Wait for page to be fully loaded (CSS, fonts, images) before initializing Clarity
              function initClarity() {
                (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];
                  try {
                    if (y && y.parentNode && y.parentNode.contains(y)) {
                      y.parentNode.insertBefore(t,y);
                    } else {
                      (l.head || l.documentElement).appendChild(t);
                    }
                  } catch (e) {
                    try { (l.head || l.documentElement).appendChild(t); } catch {}
                  }
                })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
              }
              
              // Check if all stylesheets are loaded
              function stylesheetsReady() {
                var sheets = document.querySelectorAll('link[rel="stylesheet"]');
                for (var i = 0; i < sheets.length; i++) {
                  if (sheets[i].sheet === null) return false;
                }
                return true;
              }
              
              function tryInit() {
                if (document.readyState === 'complete' && stylesheetsReady()) {
                  initClarity();
                } else {
                  // Retry until ready, max 5s
                  setTimeout(tryInit, 200);
                }
              }
              
              if (document.readyState === 'complete' && stylesheetsReady()) {
                initClarity();
              } else {
                window.addEventListener('load', function() {
                  // Extra delay after load to ensure Next.js hydration + CSS injection complete
                  setTimeout(tryInit, 500);
                });
              }
              } // end else (not excluded)
            `}
          </Script>
        ) : null}
        {/* Hotjar / Contentsquare - session recordings (excluded for test/localhost/staging) */}
        <Script id="hotjar-init" strategy="afterInteractive">
          {`
            (function() {
              // Check kh_test cookie
              if (document.cookie.split(';').some(c => c.trim().startsWith('kh_test=1'))) {
                console.log('[Hotjar] Excluded: test cookie');
                return;
              }
              // Check localhost
              var h = window.location.hostname;
              if (h === 'localhost' || h === '127.0.0.1') {
                console.log('[Hotjar] Excluded: localhost');
                return;
              }
              // Check staging/preview
              if (h.includes('.vercel.app') || h.includes('staging') || h.includes('preview')) {
                console.log('[Hotjar] Excluded: staging/preview');
                return;
              }
              // Load Hotjar/Contentsquare
              var s = document.createElement('script');
              s.src = 'https://t.contentsquare.net/uxa/72ed21e97b29d.js';
              s.async = true;
              document.head.appendChild(s);
            })();
          `}
        </Script>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-gray-900 focus:px-3 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900">
          Zum Inhalt springen
        </a>
        <Header />
        <TestMode />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
        <AnalyticsProvider />
        <ErrorTracker />
        <ClarityLoader />
        {!COOKIES_ENABLED && <NoCookieToast />}
        {COOKIES_ENABLED && <CookieBanner />}
      </body>
    </html>
  );
}
