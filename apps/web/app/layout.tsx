import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { PwaRegister } from "./components/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/brand-mark.svg", type: "image/svg+xml" },
      { url: "/pwa-icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: "BenimÖğretmenim — özel ders ve öğretmen eşleşmesi",
    template: "%s · BenimÖğretmenim",
  },
  description:
    "Branş ve şehre göre öğretmen bulun; talep açın, teklifleri karşılaştırın, güvenle eşleşin. Öğretmenler için abonelik ve veli gelişim özeti.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "BenimÖğretmenim",
  },
  twitter: {
    card: "summary_large_image",
    title: "BenimÖğretmenim",
    description:
      "Öğretmen bul, ders talebi oluştur, teklifleri karşılaştır; online veya yüz yüze.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper-50 font-sans text-paper-900">
        <PwaRegister />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
