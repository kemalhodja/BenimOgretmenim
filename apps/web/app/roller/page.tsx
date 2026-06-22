import type { Metadata } from "next";
import Link from "next/link";
import { AuthEntryLink } from "../components/AuthEntryLink";
import { RoleFeatureOverview } from "../components/marketing/RoleFeatureOverview";
import { ROLE_FEATURE_CARDS } from "../lib/roleFeatures";
import { publicSiteUrl } from "../lib/siteUrl";

const rollerUrl = `${publicSiteUrl()}/roller`;

function rollerJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Roller ve platform özellikleri",
    description:
      "Öğrenci, öğretmen, veli ve yönetici rollerinin BenimÖğretmenim'de kullanabildiği tüm özellikler.",
    url: rollerUrl,
    isPartOf: { "@type": "WebSite", name: "BenimÖğretmenim", url: publicSiteUrl() },
    about: ROLE_FEATURE_CARDS.map((card) => ({
      "@type": "Thing",
      name: card.role,
      description: card.summary,
    })),
  };
}

export const metadata: Metadata = {
  title: "Roller ve platform özellikleri",
  description:
    "Öğrenci, öğretmen, veli ve yönetici rollerinin BenimÖğretmenim'de kullanabildiği tüm özellikler.",
  alternates: { canonical: rollerUrl },
  openGraph: {
    title: "Roller ve platform özellikleri · BenimÖğretmenim",
    description: "Her rolün panelinde neler var? Eksiksiz özellik listesi.",
    url: rollerUrl,
    locale: "tr_TR",
    type: "website",
  },
};

export default function RollerPage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">Referans</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-paper-950">Kim ne yapabilir?</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-paper-800/75">
          Bu sayfa, platformdaki tüm rol yeteneklerinin tek ve güncel listesidir. Fiyat, abonelik ve kayıt
          sayfalarıyla aynı kaynaktan beslenir.
        </p>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(rollerJsonLd()) }} />
        <div className="mt-8">
          <RoleFeatureOverview includeAdmin showSubscription maxListHeightClass="max-h-96" />
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/kayit"
            className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Kayıt ol
          </Link>
          <AuthEntryLink
            path="/fiyatlar"
            className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Fiyatlar
          </AuthEntryLink>
          <Link href="/yardim" className="text-sm font-medium text-brand-800 underline underline-offset-4">
            Yardım
          </Link>
        </div>
      </div>
    </div>
  );
}
