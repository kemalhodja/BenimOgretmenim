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
    <span className="flex min-w-0 items-center">
      <Image
        src="/logo-marketing.png"
        alt={`Benim Öğretmenim — ${TAGLINE}`}
        width={220}
        height={113}
        priority
        sizes="(max-width: 640px) 150px, 190px"
        className="h-12 w-auto rounded-xl object-contain sm:h-14"
      />
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
