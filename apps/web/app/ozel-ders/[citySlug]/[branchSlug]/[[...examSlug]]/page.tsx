import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerApiBaseUrl } from "../../../../lib/api";
import { publicSiteUrl } from "../../../../lib/siteUrl";

type City = { id: number; name: string; slug: string };
type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type LandingParams = {
  citySlug: string;
  branchSlug: string;
  examSlug?: string[];
};

const examLabels: Record<string, string> = {
  lgs: "LGS",
  yks: "YKS",
  tyt: "TYT",
  ayt: "AYT",
  ydt: "YDT",
  kpss: "KPSS",
  ales: "ALES",
  dgs: "DGS",
};

function examLabel(slug: string | undefined): string | null {
  if (!slug) return null;
  return examLabels[slug] ?? slug.replaceAll("-", " ").toLocaleUpperCase("tr-TR");
}

async function loadMeta() {
  const api = getServerApiBaseUrl();
  const [citiesRes, branchesRes] = await Promise.all([
    fetch(`${api}/v1/meta/cities`, { headers: { accept: "application/json" }, next: { revalidate: 3600 } }),
    fetch(`${api}/v1/meta/branches`, { headers: { accept: "application/json" }, next: { revalidate: 3600 } }),
  ]);
  if (!citiesRes.ok || !branchesRes.ok) throw new Error("seo_meta_failed");
  const [citiesBody, branchesBody] = (await Promise.all([
    citiesRes.json(),
    branchesRes.json(),
  ])) as [{ cities?: City[] }, { branches?: Branch[] }];
  return {
    cities: citiesBody.cities ?? [],
    branches: branchesBody.branches ?? [],
  };
}

async function resolveLanding(params: LandingParams) {
  const { cities, branches } = await loadMeta();
  const city = cities.find((x) => x.slug === params.citySlug);
  const branch = branches.find((x) => x.slug === params.branchSlug);
  if (!city || !branch) return null;
  const hasChild = new Set(branches.filter((b) => b.parent_id != null).map((b) => b.parent_id));
  if (hasChild.has(branch.id)) return null;
  const exam = examLabel(params.examSlug?.[0]);
  return { city, branch, exam };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<LandingParams>;
}): Promise<Metadata> {
  const p = await params;
  const landing = await resolveLanding(p).catch(() => null);
  if (!landing) {
    return { title: "Özel ders" };
  }
  const examPrefix = landing.exam ? `${landing.exam} ` : "";
  const title = `${landing.city.name} ${examPrefix}${landing.branch.name} özel ders`;
  const url = `${publicSiteUrl()}/ozel-ders/${p.citySlug}/${p.branchSlug}${
    p.examSlug?.[0] ? `/${p.examSlug[0]}` : ""
  }`;
  return {
    title,
    description: `${landing.city.name} için ${examPrefix}${landing.branch.name} öğretmenlerini karşılaştırın, profilden demo ders talep edin ve platform içinde güvenle ders planlayın.`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      title: `${title} · BenimÖğretmenim`,
      description: "Doğru öğretmeni bulun, demo dersle deneyin, devam paketine güvenle geçin.",
      url,
    },
  };
}

export default async function SeoLandingPage({
  params,
}: {
  params: Promise<LandingParams>;
}) {
  const p = await params;
  const landing = await resolveLanding(p).catch(() => null);
  if (!landing) notFound();

  const teacherHref = `/ogretmenler?cityId=${landing.city.id}&branchId=${landing.branch.id}`;
  const requestHref = `/student/requests?branchId=${landing.branch.id}`;
  const examText = landing.exam ? `${landing.exam} odaklı ` : "";

  return (
    <div className="min-h-screen bg-paper-50">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-paper-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-800">Özel ders landing</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-paper-900">
            {landing.city.name} {landing.exam ? `${landing.exam} ` : ""}
            {landing.branch.name} özel ders
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-paper-800/75">
            {landing.city.name} içinde {examText}
            {landing.branch.name} öğretmeni arayan öğrenciler için hızlı yol: öğretmen profillerini
            karşılaştırın, kalite rozetlerini inceleyin, demo ders talep edin ve kabul sonrası meeting
            linkiyle 30 dakikalık deneme oturumuna geçin.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={teacherHref}
              className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Öğretmenleri listele
            </Link>
            <Link
              href={requestHref}
              className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
            >
              Talep oluştur
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Kaliteli profilleri karşılaştır", "Video, belge, yorum ve tamamlanan ders sinyallerini gör."],
            ["2", "Demo dersle dene", "Öğretmen yanıtından sonra 30 dakikalık online oturum planlanır."],
            ["3", "Pakete geç veya devam et", "Demo sonrası paket, kurs, ödev desteği veya farklı öğretmen seçimi yapılır."],
          ].map(([step, title, desc]) => (
            <div key={step} className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-brand-800">Adım {step}</div>
              <h2 className="mt-1 text-base font-semibold text-paper-900">{title}</h2>
              <p className="mt-2 text-sm text-paper-800/65">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
