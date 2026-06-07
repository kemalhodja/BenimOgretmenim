import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConditionalSiteChrome } from "./components/ConditionalSiteChrome";
import { InstallAppBanner } from "./components/InstallAppBanner";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { PwaRegister } from "./components/PwaRegister";
import { SiteWideJsonLd } from "./components/SiteWideJsonLd";
import { SupportWidget } from "./components/SupportWidget";
import { publicSiteUrl } from "./lib/siteUrl";

const siteUrl = publicSiteUrl();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a6680",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "BenimÖğretmenim",
  appleWebApp: {
    capable: true,
    title: "BenimÖğretmenim",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192", sizes: "192x192", type: "image/png" },
      { url: "/icon", sizes: "512x512", type: "image/png" },
      { url: "/brand-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: "BenimÖğretmenim — özel ders",
    template: "%s · BenimÖğretmenim",
  },
  description:
    "Öğretmen arayın, talep açın, teklifleri karşılaştırın. Öğretmen aboneliği ve veli özeti.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "BenimÖğretmenim",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "BenimÖğretmenim",
    description: "Öğretmen bul, talep aç, teklifleri karşılaştır.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-paper-50 font-sans text-paper-900">
        <SiteWideJsonLd />
        <PwaRegister />
        <ConditionalSiteChrome
          marketingHeader={<SiteHeader />}
          marketingFooter={<SiteFooter />}
        >
          <main className="flex-1">{children}</main>
        </ConditionalSiteChrome>
        <InstallAppBanner />
        <SupportWidget />
      </body>
    </html>
  );
}
