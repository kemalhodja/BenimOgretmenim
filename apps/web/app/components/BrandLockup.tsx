import Image from "next/image";
import Link from "next/link";

const TAGLINE = "Online Akademi";

type Props = {
  /** Ana sayfaya yönlendir; header’da true */
  asLink?: boolean;
  className?: string;
};

/** Şeffaf arka planlı tam logo: `public/logo-marketing.png` (`npm run logo:strip-bg`). */
export function BrandLockup({ asLink = true, className = "" }: Props) {
  const inner = (
    <Image
      src="/logo-marketing.png"
      alt={`Benim Öğretmenim — ${TAGLINE}`}
      width={400}
      height={150}
      sizes="(max-width: 640px) 280px, 360px"
      className="h-12 w-auto max-w-[min(280px,88vw)] shrink-0 object-contain object-left sm:h-16 sm:max-w-[min(380px,52vw)]"
      priority
    />
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
