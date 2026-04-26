const sizeMap = { sm: 32, md: 40, lg: 48 } as const;

/** Aynı sayfada yalnızca bir mark kullanıldığında güvenli (gradient id). */
const GRAD_ID = "bmo-mark-bg";

type BrandLogoSize = keyof typeof sizeMap;

type Props = {
  /** Sadece ikon (varsayılan) */
  variant?: "mark";
  className?: string;
  size?: BrandLogoSize;
  /** Açıklayıcı kısa metin (görünmeyen) */
  title?: string;
};

/**
 * Marka: açık kitap (özel ders / eğitim) — net silüet, küçük okunabilir, emoji yüz hissi yok.
 */
export function BrandLogo({
  className = "",
  size = "sm",
  title = "Benim Öğretmenim",
  variant = "mark",
}: Props) {
  const s = sizeMap[size];
  const g = `url(#${GRAD_ID})`;

  if (variant !== "mark") {
    return null;
  }

  return (
    <span className={className} title={title} role="img" aria-label={title}>
      <svg
        width={s}
        height={s}
        viewBox="0 0 40 40"
        className="drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={GRAD_ID} x1="4" y1="6" x2="35" y2="34">
            <stop stopColor="rgb(79 98 178)" />
            <stop offset="0.5" stopColor="rgb(42 66 122)" />
            <stop offset="0.88" stopColor="rgb(195 95 63)" stopOpacity="0.92" />
            <stop offset="1" stopColor="rgb(20 31 59)" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          fill={g}
          stroke="rgb(20 31 59 / 0.22)"
          strokeWidth="0.4"
        />
        {/* Açık kitap — sol + sağ sayfa */}
        <path
          d="M8.2 12.2 20.5 7.4 20.5 30.1 8.2 28.1z"
          fill="white"
          fillOpacity="0.98"
        />
        <path
          d="M20.5 7.4 31.8 12.2 31.8 28.1 20.5 30.1z"
          fill="white"
          fillOpacity="0.88"
        />
        <path
          d="M20.5 7.4V30.1"
          stroke="rgb(128 60 45 / 0.35)"
          strokeWidth="0.65"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
