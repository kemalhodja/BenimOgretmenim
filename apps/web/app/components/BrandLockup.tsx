import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

const TAGLINE = "Online Akademi";

type Props = {
  /** Ana sayfaya yönlendir; header’da true */
  asLink?: boolean;
  className?: string;
};

export function BrandLockup({ asLink = true, className = "" }: Props) {
  const inner = (
    <span className="flex min-w-0 items-center gap-3">
      <BrandLogo size="lg" className="shrink-0" />
      <span className="min-w-0 leading-none">
        <span className="block whitespace-nowrap text-[1.15rem] font-black tracking-[-0.04em] text-paper-950 sm:text-[1.55rem]">
          BenimÖğretmenim
        </span>
        <span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-[0.28em] text-brand-800 sm:text-[0.72rem]">
          {TAGLINE}
        </span>
      </span>
    </span>
  );

  const base =
    "group flex min-w-0 items-center transition hover:opacity-[0.98] " + className;

  if (asLink) {
    return (
      <Link
        href="/"
        className={base + " no-underline"}
        title={`Benim Öğretmenim — ${TAGLINE}`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={base}>{inner}</div>;
}
