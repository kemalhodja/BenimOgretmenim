/**
 * Marka amblemi (tek kaynak): logo paleti — teal kağıt + mercan vurgu.
 * `public/brand-mark.svg` ile aynı geometriyi koru. `gradId` sayfada benzersiz olmalı.
 */
export function buildBrandMarkSvgXml(gradId: string, pixelSize: number): string {
  const foldGradId = `${gradId}_fold`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${gradId}" x1="5" y1="4" x2="35" y2="36" gradientUnits="userSpaceOnUse">
      <stop stop-color="#28c4b5"/>
      <stop offset="0.55" stop-color="#0f8f83"/>
      <stop offset="1" stop-color="#0b4a43"/>
    </linearGradient>
    <linearGradient id="${foldGradId}" x1="24" y1="7" x2="34" y2="17" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffb199"/>
      <stop offset="1" stop-color="#e85d3f"/>
    </linearGradient>
  </defs>
  <rect x="2.5" y="2.5" width="35" height="35" rx="11" fill="url(#${gradId})" stroke="#083d37" stroke-opacity="0.25"/>
  <path d="M12 30V11.5c0-1.1.9-2 2-2h10.8c1.25 0 2.38.74 2.88 1.88l1.47 3.37H22.5c-1.1 0-2 .9-2 2V30H12z" fill="#ffffff"/>
  <path d="M20.5 16.75c0-1.1.9-2 2-2h6.65L33 18.6V30H20.5V16.75z" fill="#eafffb"/>
  <path d="M29.15 14.75v3.85H33l-3.85-3.85z" fill="url(#${foldGradId})"/>
  <path d="M15.2 17.2h10.1M15.2 21h12M15.2 24.8h8.6" stroke="#0b5f56" stroke-width="1.7" stroke-linecap="round"/>
  <circle cx="29.7" cy="27.7" r="2.2" fill="#e85d3f"/>
</svg>`;
}

export function brandMarkDataUri(gradId: string): string {
  const xml = buildBrandMarkSvgXml(gradId, 40);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}
