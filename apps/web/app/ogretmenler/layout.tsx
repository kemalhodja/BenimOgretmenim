import type { Metadata } from "next";
import { publicSiteUrl } from "../lib/siteUrl";

const ogretmenlerUrl = `${publicSiteUrl()}/ogretmenler`;

export const metadata: Metadata = {
  title: "Öğretmenler",
  description:
    "Branş, şehir ve isimle öğretmen arayın; puan ve doğrulama bilgilerine göre sıralı liste. Talep açıp teklifleri karşılaştırın.",
  alternates: { canonical: ogretmenlerUrl },
  openGraph: {
    type: "website",
    title: "Öğretmen ara · BenimÖğretmenim",
    description:
      "Matematik, fen ve daha fazlası için öğretmen bulun; özel ders talebi oluşturun.",
    url: ogretmenlerUrl,
    locale: "tr_TR",
  },
};

export default function OgretmenlerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
