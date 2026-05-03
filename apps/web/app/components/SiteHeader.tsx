import Link from "next/link";
import { BrandLockup } from "./BrandLockup";
import { LoginNavLink, RegisterNavLink } from "./AuthNavLinks";

const nav = [
  { href: "/ogretmenler", label: "Öğretmen ara" },
  { href: "/#nasil", label: "Nasıl çalışır?" },
  { href: "/panel", label: "Panel" },
  { href: "/courses", label: "Kurslar" },
  { href: "/fiyatlar", label: "Fiyatlar" },
  { href: "/iletisim", label: "İletişim" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-paper-200/80 bg-paper-50/95 shadow-[0_1px_0_0_rgb(0_0_0/0.04)] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <BrandLockup className="max-sm:max-w-[min(70vw,16rem)]" />
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper-800/75 transition hover:bg-paper-100/80 hover:text-paper-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/kampanya"
            className="hidden rounded-full border border-warm-200/90 bg-warm-50/90 px-3 py-1.5 text-xs font-semibold text-warm-900 shadow-sm transition hover:border-warm-300 hover:bg-warm-100/90 sm:inline-flex"
          >
            Kampanya
          </Link>
          <LoginNavLink className="rounded-lg px-3 py-1.5 text-sm font-medium text-paper-800/80 hover:bg-paper-100/80">
            Giriş
          </LoginNavLink>
          <RegisterNavLink className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800">
            Kayıt ol
          </RegisterNavLink>
        </div>
      </div>
      <nav className="flex border-t border-paper-200/70 px-2 py-1.5 md:hidden">
        <div className="flex w-full justify-between gap-1 overflow-x-auto text-xs">
          <Link
            href="/kampanya"
            className="shrink-0 rounded-md bg-warm-100/80 px-2 py-1 font-semibold text-warm-900 hover:bg-warm-200/50"
          >
            Kampanya
          </Link>
          {nav.slice(0, 6).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-2 py-1 text-paper-800/80 hover:bg-paper-100/80"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
