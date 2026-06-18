import type { Metadata } from "next";
import { publicSiteUrl } from "../lib/siteUrl";

const itirazUrl = `${publicSiteUrl()}/itiraz`;

export const metadata: Metadata = {
  title: "İtiraz ve destek",
  description:
    "BenimÖğretmenim itiraz ve anlaşmazlık talebi: ödeme, ödev, ders paketi ve hesap işlemleri için destek kaydı açın.",
  alternates: { canonical: itirazUrl },
};

export default function ItirazLayout({ children }: { children: React.ReactNode }) {
  return children;
}
