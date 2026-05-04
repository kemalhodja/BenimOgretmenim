"use client";

import Link from "next/link";

const panelLinks = [
  { href: "/teacher", label: "Özet" },
  { href: "/teacher/requests", label: "Açık talepler" },
  { href: "/teacher/teklifler", label: "Tekliflerim" },
  { href: "/teacher/dersler", label: "Ders oturumları" },
  { href: "/teacher/kurslar", label: "Online kurslar" },
  { href: "/teacher/cuzdan", label: "Cüzdan" },
  { href: "/fiyatlar", label: "Abonelik fiyatları" },
] as const;

const generalLinks = [
  { href: "/yardim", label: "Yardım" },
  { href: "/iletisim", label: "İletişim" },
  { href: "/gizlilik", label: "Gizlilik" },
  { href: "/kullanim-kosullari", label: "Koşullar" },
  { href: "/uygulama", label: "PWA" },
] as const;

export function TeacherPanelFooter() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002";

  return (
    <footer className="mt-auto border-t border-paper-200/80 bg-paper-100/40">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">
              Öğretmen paneli
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-paper-800/90">
              {panelLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">
              Genel
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-paper-800/90">
              {generalLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/" className="hover:underline">
                  Ana sayfa (site)
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2 border-t border-paper-200/80 pt-6 text-xs text-paper-800/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} BenimÖğretmenim · öğretmen alanı</span>
          <span className="font-mono text-[10px] text-paper-800/45">API: {api}</span>
        </div>
      </div>
    </footer>
  );
}
