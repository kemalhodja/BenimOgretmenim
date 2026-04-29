import { buildBrandMarkSvgXml } from "../lib/brandMarkSvg";

const sizeMap = { sm: 32, md: 40, lg: 48 } as const;

/** Aynı sayfada tek marka kullanımı için sabit gradient id (SiteHeader’da bir kez). */
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
 * Marka: açık kitap + indigo gradient — küçük boyutta okunaklı, tek tip palet.
 */
export function BrandLogo({
  className = "",
  size = "sm",
  title = "Benim Öğretmenim",
  variant = "mark",
}: Props) {
  const s = sizeMap[size];

  if (variant !== "mark") {
    return null;
  }

  const svg = buildBrandMarkSvgXml(GRAD_ID, s);

  return (
    <span
      className={`inline-block leading-none drop-shadow-sm ${className}`.trim()}
      title={title}
      role="img"
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
