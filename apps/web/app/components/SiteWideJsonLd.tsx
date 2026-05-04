import { publicSiteUrl } from "../lib/siteUrl";

/**
 * Organization + WebSite (Google Sitelinks arama kutusu şeması için SearchAction).
 * @see https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
 */
export function SiteWideJsonLd() {
  const siteUrl = publicSiteUrl();
  const graph = [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "BenimÖğretmenim",
      url: siteUrl,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "BenimÖğretmenim",
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/ogretmenler?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
  const data = { "@context": "https://schema.org", "@graph": graph };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
