"use client";

import Link from "next/link";
import { BrandLockup } from "./BrandLockup";
import { HeaderAuthActions } from "./HeaderAuthActions";
import {
  panelHeaderBar,
  panelNavLinkDesk,
  panelNavLinkMob,
  panelNavSubrow,
} from "./panelChrome";

export function GuardianPanelHeader() {
  return (
    <header className={panelHeaderBar}>
      <div className="mx-auto flex min-h-[4rem] max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/guardian" className="min-w-0 shrink no-underline" title="Veli özeti">
          <BrandLockup asLink={false} className="max-sm:max-w-[min(90vw,22rem)]" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/yardim" className={panelNavLinkDesk}>
            Yardım
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderAuthActions />
        </div>
      </div>
      <nav className={`flex ${panelNavSubrow} md:hidden`}>
        <div className="flex w-full overflow-x-auto text-xs">
          <Link href="/yardim" className={panelNavLinkMob}>
            Yardım
          </Link>
        </div>
      </nav>
    </header>
  );
}
