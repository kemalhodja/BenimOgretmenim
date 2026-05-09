"use client";

import Link from "next/link";

const footerLinks = [
  { href: "/guardian", label: "Özet" },
  { href: "/yardim", label: "Yardım" },
  { href: "/iletisim", label: "İletişim" },
  { href: "/gizlilik", label: "Gizlilik" },
  { href: "/kullanim-kosullari", label: "Kullanım koşulları" },
] as const;

export function GuardianPanelFooter() {
  return (
    <footer className="mt-auto border-t border-paper-200/80 bg-paper-100/40">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-paper-800/90">
          {footerLinks.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-paper-200/80 pt-4 text-xs text-paper-800/55">
          © {new Date().getFullYear()} BenimÖğretmenim · veli alanı
        </div>
      </div>
    </footer>
  );
}
