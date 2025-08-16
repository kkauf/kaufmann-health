import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
