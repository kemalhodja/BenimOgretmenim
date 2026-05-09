import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AuthEntryLink } from "../components/AuthEntryLink";
import { RegisterNavLink } from "../components/AuthNavLinks";
import { getServerApiBaseUrl } from "../lib/api";
import { makeRequestId } from "../lib/requestId";
import { publicSiteUrl } from "../lib/siteUrl";

const fiyatlarUrl = `${publicSiteUrl()}/fiyatlar`;

export const metadata: Metadata = {
  title: "Öğretmen abonelik fiyatları",
  description: "Öğretmen abonelik planları ve güncel fiyatlar.",
  alternates: { canonical: fiyatlarUrl },
  openGraph: {
    title: "Öğretmen abonelik fiyatları · BenimÖğretmenim",
    description: "Plan süreleri, güncel tutarlar ve ödeme seçenekleri.",
    url: fiyatlarUrl,
    locale: "tr_TR",
    type: "website",
  },
};

type PlanRow = {
  code: string;
  title: string;
  duration_months: number;
  price_minor: number;
  currency: string;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

export default async function FiyatlarPage() {
  const api = getServerApiBaseUrl();

  let plans: PlanRow[] = [];
  let loadError: string | null = null;
  try {
    const h = await headers();
    const incomingRid = h.get("x-request-id")?.trim();
    const requestId = incomingRid && incomingRid.length > 0 ? incomingRid : makeRequestId();

    const res = await fetch(`${api}/v1/subscriptions/plans`, {
      headers: {
        accept: "application/json",
        "x-request-id": requestId,
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      loadError = `Planlar yüklenemedi (${res.status})`;
    } else {
      const body = (await res.json()) as { plans?: PlanRow[] };
      plans = body.plans ?? [];
    }
  } catch {
    loadError = "Planlar yüklenemedi. Sayfayı yenileyin veya öğretmen panelinden deneyin.";
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-paper-900">
          Abonelik fiyatları
        </h1>
        <p className="mt-2 max-w-xl text-sm text-paper-800/75">
          Ücretsiz planda sınırlı teklif; abonelikte sınırsız. Ödeme öğretmen panelinden.
        </p>

        {loadError && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {loadError}
          </div>
        )}

        {!loadError && plans.length === 0 && (
          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75">
            Şu an listelenecek aktif plan yok.
          </div>
        )}

        <ul className="mt-8 space-y-3">
          {plans.map((p) => (
            <li
              key={p.code}
              className="rounded-xl border border-paper-200 bg-white p-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-paper-900">{p.title}</div>
                  <div className="mt-1 text-sm text-paper-800/55">
                    {p.duration_months} ay · {p.code}
                  </div>
                </div>
                <div className="text-xl font-semibold text-brand-800">
                  {minorToTl(p.price_minor)} {p.currency}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <RegisterNavLink className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900">
            Öğretmen kaydı
          </RegisterNavLink>
          <AuthEntryLink
            path="/teacher"
            className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Öğretmen paneli
          </AuthEntryLink>
          <Link href="/" className="text-sm font-medium text-paper-800/65 underline-offset-4 hover:text-paper-900">
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
