import Link from "next/link";
import Image from "next/image";

const TAGLINE = "Online Akademi";

type Props = {
  /** Ana sayfaya yönlendir; header’da true */
  asLink?: boolean;
  className?: string;
};

export function BrandLockup({ asLink = true, className = "" }: Props) {
  const inner = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image
        src="/logo-marketing.png"
        alt=""
        width={220}
        height={113}
        priority
        sizes="(max-width: 640px) 150px, 190px"
        className="h-11 w-auto rounded-xl object-contain shadow-sm ring-1 ring-paper-200/80 sm:h-12"
      />
      <span className="min-w-0 leading-none">
        <span className="block whitespace-nowrap text-lg font-extrabold tracking-tight text-paper-950 sm:text-xl">
          BenimÖğretmenim
        </span>
        <span className="mt-1 block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-800">
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
