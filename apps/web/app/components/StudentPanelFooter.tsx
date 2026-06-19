"use client";

import Link from "next/link";
import { panelSupportLinks } from "../lib/marketingLinks";

const footerLinks = [
  ...panelSupportLinks,
  { href: "/gizlilik", label: "Gizlilik" },
  { href: "/kullanim-kosullari", label: "Kullanım koşulları" },
  { href: "/uygulama", label: "Uygulamayı yükle" },
] as const;

export function StudentPanelFooter() {
  return (
    <footer className="mt-auto border-t border-paper-200/80 bg-paper-100/40">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-xs text-paper-800/60">
          Tüm sayfalar için üstteki menüyü kullanın.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-paper-800/90">
          {footerLinks.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-paper-200/80 pt-4 text-xs text-paper-800/55">
          © {new Date().getFullYear()} BenimÖğretmenim · öğrenci alanı
        </div>
      </div>
    </footer>
  );
}
