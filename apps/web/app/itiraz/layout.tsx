import type { Metadata } from "next";
import { publicSiteUrl } from "../lib/siteUrl";

const itirazUrl = `${publicSiteUrl()}/itiraz`;

export const metadata: Metadata = {
  title: "İtiraz ve anlaşmazlık",
  description:
    "Ödeme, ders, ödev veya hesap durumu hakkında itiraz süreci. Kayıt numarası ile takip; şeffaf destek ve SLA.",
  alternates: { canonical: itirazUrl },
};

export default function ItirazLayout({ children }: { children: React.ReactNode }) {
  return children;
}
