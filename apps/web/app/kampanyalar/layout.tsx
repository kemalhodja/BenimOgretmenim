import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getServerApiBaseUrl } from "../lib/api";
import { numberOrNull, readRecordArray, stringOrNull, type JsonRecord } from "../lib/publicSeo";
import { publicSiteUrl } from "../lib/siteUrl";

const kampanyalarUrl = `${publicSiteUrl()}/kampanyalar`;

type SsrCampaign = {
  id: string;
  title: string;
  teacher_display_name: string;
  branch_name: string | null;
  city_name: string | null;
  price_minor: number | null;
  currency: string | null;
};

function toSsrCampaign(row: JsonRecord): SsrCampaign | null {
  const id = stringOrNull(row.id);
  const title = stringOrNull(row.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    teacher_display_name: stringOrNull(row.teacher_display_name) ?? "Öğretmen",
    branch_name: stringOrNull(row.branch_name),
    city_name: stringOrNull(row.city_name),
    price_minor: numberOrNull(row.price_minor),
    currency: stringOrNull(row.currency),
  };
}

async function loadSsrCampaigns(): Promise<SsrCampaign[]> {
  try {
    const api = getServerApiBaseUrl();
    const res = await fetch(`${api}/v1/teacher-campaigns?limit=6&status=published`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return readRecordArray(body, "campaigns")
      .map(toSsrCampaign)
      .filter((campaign): campaign is SsrCampaign => campaign !== null);
  } catch {
    return [];
  }
}

function campaignPrice(campaign: SsrCampaign): string {
  if (campaign.price_minor == null) return "Ücret profilde";
  return `${(campaign.price_minor / 100).toFixed(2)} ${campaign.currency ?? "TRY"}`;
}

export const metadata: Metadata = {
  title: "Öğretmen kampanyaları",
  description:
    "TYT, LGS, online kamp, yoğun tekrar ve özel ders paketleri için öğretmen kampanyalarını inceleyin.",
  alternates: { canonical: kampanyalarUrl },
  openGraph: {
    title: "Öğretmen kampanyaları · BenimÖğretmenim",
    description:
      "Öğretmenlerin hazırladığı kamp, tekrar ve sınav hazırlık ilanlarına başvuru bırakın.",
    url: kampanyalarUrl,
    locale: "tr_TR",
    type: "website",
  },
};

export default async function KampanyalarLayout({ children }: { children: ReactNode }) {
  const campaigns = await loadSsrCampaigns();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Öğretmen kampanyaları",
    url: kampanyalarUrl,
    description: "Öğretmenlerin yayınladığı online ve yüz yüze eğitim kampanyaları.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: campaigns.length
        ? campaigns.map((campaign, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${kampanyalarUrl}?campaign=${campaign.id}`,
            name: campaign.title,
          }))
        : [
            { "@type": "ListItem", position: 1, name: "TYT ve YKS kamp programları" },
            { "@type": "ListItem", position: 2, name: "LGS tekrar programları" },
            { "@type": "ListItem", position: 3, name: "Online özel ders paketleri" },
          ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {campaigns.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 pt-8">
          <div className="rounded-2xl border border-paper-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-paper-950">SSR yayındaki kampanyalar</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {campaigns.map((campaign) => (
                <Link key={campaign.id} href={`/kampanyalar?campaign=${campaign.id}`} className="rounded-xl border border-paper-200 bg-paper-50 p-3 hover:border-brand-200">
                  <div className="font-semibold text-paper-950">{campaign.title}</div>
                  <div className="mt-1 text-xs text-paper-800/60">
                    {campaign.teacher_display_name} · {campaign.branch_name ?? "Genel"} · {campaign.city_name ?? "Online"} · {campaignPrice(campaign)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {children}
    </>
  );
}
