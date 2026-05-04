import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kayıt",
  description: "Öğrenci, öğretmen veya veli olarak BenimÖğretmenim'e kayıt olun.",
  robots: { index: false, follow: true },
};

export default function KayitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
