import Link from "next/link";
import { BrandLockup } from "./BrandLockup";
import { HeaderAuthActions } from "./HeaderAuthActions";
import { SiteNavLinks } from "./SiteNavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-200/35 bg-paper-50/90 shadow-[0_8px_32px_-8px_rgb(42_157_143/0.14),0_1px_0_0_rgb(231_111_81/0.08)] backdrop-blur-md">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <BrandLockup className="max-sm:max-w-[min(90vw,22rem)]" />
        <nav className="hidden items-center gap-1 md:flex">
          <SiteNavLinks variant="desktop" />
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/kampanya"
            className="hidden rounded-full border border-warm-200/90 bg-warm-50/90 px-3 py-1.5 text-xs font-semibold text-warm-900 shadow-sm transition hover:border-warm-300 hover:bg-warm-100/90 sm:inline-flex"
          >
            Kampanya
          </Link>
          <HeaderAuthActions />
        </div>
      </div>
      <nav className="flex border-t border-paper-200/70 px-2 py-2 md:hidden">
        <div className="flex w-full justify-between gap-1 overflow-x-auto text-xs">
          <Link
            href="/kampanya"
            className="shrink-0 rounded-md bg-warm-100/80 px-2 py-1 font-semibold text-warm-900 hover:bg-warm-200/50"
          >
            Kampanya
          </Link>
          <SiteNavLinks variant="mobile" />
        </div>
      </nav>
    </header>
  );
}
