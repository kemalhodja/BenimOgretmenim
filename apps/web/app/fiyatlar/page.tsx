import type { Metadata } from "next";
import Link from "next/link";
import { RegisterNavLink } from "../components/AuthNavLinks";

export const metadata: Metadata = {
  title: "Öğretmen abonelik fiyatları",
  description:
    "BenimÖğretmenim öğretmen abonelik planları: süre, fiyat ve sınırsız teklif avantajı.",
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
  const api =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:3002";

  let plans: PlanRow[] = [];
  let loadError: string | null = null;
  try {
    const res = await fetch(`${api}/v1/subscriptions/plans`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      loadError = `Planlar yüklenemedi (${res.status})`;
    } else {
      const body = (await res.json()) as { plans?: PlanRow[] };
      plans = body.plans ?? [];
    }
  } catch {
    loadError =
      "Fiyat listesi şu an alınamadı (API erişilemiyor olabilir). Sayfayı daha sonra yenileyin veya öğretmen panelinden abonelik adımına geçin.";
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="text-sm font-medium text-zinc-500">Öğretmenler için</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
          Abonelik fiyatları
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Ücretsiz hesapla sınırlı sayıda talebe teklif verebilirsiniz; abonelikle
          sınırsız teklif ve daha görünür profil avantajlarına erişirsiniz. Güncel
          tutarlar aşağıdadır; ödeme adımları için panele giriş yapın.
        </p>

        {loadError && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {loadError}
          </div>
        )}

        {!loadError && plans.length === 0 && (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Şu an listelenecek aktif plan yok.
          </div>
        )}

        <ul className="mt-8 space-y-4">
          {plans.map((p) => (
            <li
              key={p.code}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-zinc-900">{p.title}</div>
                  <div className="mt-1 text-sm text-zinc-500">
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

        <div className="mt-10 flex flex-wrap gap-3">
          <RegisterNavLink className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
            Öğretmen olarak kayıt ol
          </RegisterNavLink>
          <Link
            href="/teacher"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
          >
            Panele git
          </Link>
          <Link
            href="/"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
