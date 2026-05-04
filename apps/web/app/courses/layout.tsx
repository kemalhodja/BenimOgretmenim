import type { Metadata } from "next";
import { publicSiteUrl } from "../lib/siteUrl";

const coursesUrl = `${publicSiteUrl()}/courses`;

export const metadata: Metadata = {
  title: "Kurslar",
  description:
    "Yayındaki online ve yüz yüze kursları keşfedin; öğretmen, fiyat ve cohort bilgilerine göz atıp kayıt olun.",
  alternates: { canonical: coursesUrl },
  openGraph: {
    type: "website",
    title: "Yayındaki kurslar · BenimÖğretmenim",
    description: "Öğretmenlerin açtığı yayınlı kurslar ve kayıt seçenekleri.",
    url: coursesUrl,
    locale: "tr_TR",
  },
};

export default function CoursesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
