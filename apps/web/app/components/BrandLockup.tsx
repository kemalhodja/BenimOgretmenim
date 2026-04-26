import Link from "next/link";
import { brandTaglineFont } from "../lib/brandFont";
import { BrandLogo } from "./BrandLogo";

const TAGLINE = "Dijital Online Özel Ders Merkezi";

type Props = {
  /** Ana sayfaya yönlendir; header’da true */
  asLink?: boolean;
  className?: string;
};

/**
 * Amblem + iki satırlı tipografi: büyük renkli isim, altında ince slogan.
 */
export function BrandLockup({ asLink = true, className = "" }: Props) {
  const inner = (
    <>
      <BrandLogo
        className="shrink-0 self-start sm:self-center sm:pt-0.5"
        size="md"
      />
      <div className="min-w-0 text-left">
        <p className="m-0 text-base font-extrabold leading-tight tracking-[-0.02em] sm:text-lg">
          <span className="inline-block bg-gradient-to-r from-brand-800 via-brand-500 to-warm-500 bg-clip-text text-transparent">
            Benim Öğretmenim
          </span>
        </p>
        <p
          className={[
            brandTaglineFont.className,
            "mt-0.5 text-[0.6rem] leading-relaxed text-paper-800/75 sm:text-[0.7rem] sm:tracking-wide",
            "line-clamp-2 sm:line-clamp-1",
          ].join(" ")}
        >
          {TAGLINE}
        </p>
      </div>
    </>
  );

  const base =
    "group flex min-w-0 items-start gap-2.5 transition hover:opacity-[0.98] sm:items-center sm:gap-3 " +
    className;

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
