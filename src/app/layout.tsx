import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title:
    "Therapeutenverzeichnis – Körperorientierte Therapeuten in Ihrer Nähe | Kaufmann Health",
  description:
    "Finden Sie körperorientierte Therapeuten in Ihrer Nähe. Verzeichnis für Heilpraktiker der Psychotherapie – spezialisiert auf NARM, Hakomi und Somatic Experiencing.",
  keywords: [
    "Therapeuten finden",
    "Therapeutenverzeichnis",
    "Körperorientierte Psychotherapie",
    "NARM",
    "Hakomi",
    "Somatic Experiencing",
  ],
  openGraph: {
    title: "Therapeutenverzeichnis | Kaufmann Health",
    description:
      "Durchsuchbares Verzeichnis von Heilpraktikern für Psychotherapie. Spezialisiert auf NARM, Hakomi und Somatic Experiencing.",
    url: "https://kaufmann-health.de/",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
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
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-gray-900 focus:px-3 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900">
          Zum Inhalt springen
        </a>
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
