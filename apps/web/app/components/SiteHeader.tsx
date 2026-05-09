import { BrandLockup } from "./BrandLockup";
import { HeaderAuthActions } from "./HeaderAuthActions";
import { SiteNavLinks } from "./SiteNavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-paper-200 bg-paper-50/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-[4.25rem] max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <BrandLockup className="max-sm:max-w-[min(90vw,22rem)]" />
        <nav className="hidden items-center gap-0.5 lg:flex">
          <SiteNavLinks variant="desktop" />
        </nav>
        <div className="flex items-center gap-2">
          <HeaderAuthActions />
        </div>
      </div>
      <nav className="border-t border-paper-200/80 px-2 py-2 lg:hidden">
        <div className="flex w-full gap-1 overflow-x-auto text-xs">
          <SiteNavLinks variant="mobile" />
        </div>
      </nav>
    </header>
  );
}
