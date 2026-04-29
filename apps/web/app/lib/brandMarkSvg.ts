/**
 * Tek kaynaklı mark: header, favicon (data URI) ve public/brand-mark.svg ile uyumlu tutulmalı.
 * `gradId` sayfada benzersiz olmalı (gradient url(#id)).
 */
export function buildBrandMarkSvgXml(gradId: string, pixelSize: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${gradId}" x1="5" y1="4" x2="38" y2="38" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6b93d6"/>
      <stop offset="0.55" stop-color="#335096"/>
      <stop offset="1" stop-color="#141f3b"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="36" height="36" rx="12" fill="url(#${gradId})" stroke="#141f3b" stroke-opacity="0.14" stroke-width="0.55"/>
  <path d="M8.8 12 20.5 6.9 20.5 29.6 8.8 27.4z" fill="#ffffff" fill-opacity="0.97"/>
  <path d="M20.5 6.9 31.2 12 31.2 27.4 20.5 29.6z" fill="#ffffff" fill-opacity="0.9"/>
  <path d="M20.5 8.2V28.4" stroke="#ffffff" stroke-opacity="0.3" stroke-width="0.75" stroke-linecap="round"/>
</svg>`;
}

export function brandMarkDataUri(gradId: string): string {
  const xml = buildBrandMarkSvgXml(gradId, 40);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}
