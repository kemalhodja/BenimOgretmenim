import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerApiBaseUrl } from "../../../../lib/api";
import { publicSiteUrl } from "../../../../lib/siteUrl";

type City = { id: number; name: string; slug: string };
type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type TeacherPreview = {
  id: string;
  display_name: string;
  rating_avg: number | null;
  rating_count: number | null;
  verification_status: string;
  profile_quality_score: number | null;
  min_hourly_rate_minor: number | null;
  max_hourly_rate_minor: number | null;
  primary_branch_name: string | null;
  completed_sessions_count: number;
};
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

function priceLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Ücret bilgisi profilde";
  const left = min != null ? `${Math.round(min / 100)} TL` : "—";
  const right = max != null ? `${Math.round(max / 100)} TL` : "—";
  return `${left} - ${right} / saat`;
}

function teacherStats(teachers: TeacherPreview[]) {
  const rates = teachers
    .flatMap((teacher) => [teacher.min_hourly_rate_minor, teacher.max_hourly_rate_minor])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    teacherCount: teachers.length,
    verifiedCount: teachers.filter((teacher) => teacher.verification_status === "verified").length,
    completedLessons: teachers.reduce((sum, teacher) => sum + Number(teacher.completed_sessions_count ?? 0), 0),
    priceRange:
      rates.length > 0
        ? priceLabel(Math.min(...rates), Math.max(...rates))
        : "Fiyat aralığı öğretmen profilinde netleşir",
  };
}

async function loadTeacherPreviews(cityId: number, branchId: number): Promise<TeacherPreview[]> {
  const api = getServerApiBaseUrl();
  const qs = new URLSearchParams({
    cityId: String(cityId),
    branchId: String(branchId),
    verifiedOnly: "1",
    sort: "recommended",
    limit: "3",
  });
  const res = await fetch(`${api}/v1/teachers?${qs.toString()}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { teachers?: TeacherPreview[] };
  return body.teachers ?? [];
}

function landingJsonLd(opts: {
  url: string;
  city: City;
  branch: Branch;
  exam: string | null;
  faq: Array<{ question: string; answer: string }>;
}): Record<string, unknown> {
  const title = `${opts.city.name} ${opts.exam ? `${opts.exam} ` : ""}${opts.branch.name} özel ders`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: title,
        serviceType: "Özel ders ve online eğitim",
        areaServed: { "@type": "City", name: opts.city.name },
        provider: { "@type": "Organization", name: "BenimÖğretmenim", url: publicSiteUrl() },
        url: opts.url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: publicSiteUrl() },
          { "@type": "ListItem", position: 2, name: "Özel ders", item: `${publicSiteUrl()}/ogretmenler` },
          { "@type": "ListItem", position: 3, name: title, item: opts.url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: opts.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
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
    description: `${landing.city.name} için ${examPrefix}${landing.branch.name} öğretmenlerini karşılaştırın; teklif, canlı sınıf, soru çözüm ve çalışma takibiyle güvenle ilerleyin.`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      title: `${title} · BenimÖğretmenim`,
      description: "Doğru öğretmeni bulun, teklifleri karşılaştırın, soru çözüm ve çalışma takibiyle süreci yönetin.",
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
  const teacherVerifiedHref = `${teacherHref}&verifiedOnly=1&sort=recommended`;
  const requestHref = `/student/requests?branchId=${landing.branch.id}`;
  const homeworkHref = `/student/odev-sor`;
  const examText = landing.exam ? `${landing.exam} odaklı ` : "";
  const pageUrl = `${publicSiteUrl()}/ozel-ders/${p.citySlug}/${p.branchSlug}${
    p.examSlug?.[0] ? `/${p.examSlug[0]}` : ""
  }`;
  const teachers = await loadTeacherPreviews(landing.city.id, landing.branch.id).catch(() => []);
  const stats = teacherStats(teachers);
  const faq = [
    {
      question: `${landing.city.name} ${landing.branch.name} özel ders öğretmeni nasıl seçilir?`,
      answer:
        "Öğretmen profillerinde doğrulama durumu, video tanıtım, belge/doküman, tamamlanan ders ve fiyat aralığı bilgilerini birlikte karşılaştırabilirsiniz.",
    },
    {
      question: "Demo ders veya teklif karşılaştırma nasıl ilerler?",
      answer:
        "Profil üzerinden talep açabilir veya tek talep oluşturup gelen öğretmen tekliflerini ücret, kalite ve yanıt bilgisiyle karşılaştırabilirsiniz.",
    },
    {
      question: "Sadece özel ders değil, soru çözümü de alabilir miyim?",
      answer:
        "Evet. Öğrenci panelinde fotoğraflı soru gönderme, aciliyet seçme, çözüm kalitesi takibi ve çalışma planı birlikte kullanılabilir.",
    },
    {
      question: `${landing.city.name} ${landing.branch.name} özel ders ücretleri nasıl netleşir?`,
      answer:
        "Öğretmen profilindeki saatlik aralık başlangıç bilgisidir. Net ücret; seviye, hedef sınav, ders sıklığı, online/yüz yüze tercih ve paket kapsamı görüşüldükten sonra ödeme adımından önce görünür.",
    },
    {
      question: "Ödeme ve ders süreci nasıl güvenceye alınır?",
      answer:
        "Platform içinde ilerleyen paket ve derslerde ödeme, ders kaydı, canlı ders bağlantısı, öğretmen notu ve destek kayıtları birlikte takip edilir.",
    },
  ];

  return (
    <div className="min-h-screen bg-paper-50">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd({ url: pageUrl, ...landing, faq })) }}
        />
        <div className="rounded-2xl border border-paper-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-800">
            {landing.city.name} özel ders rehberi
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-paper-900">
            {landing.city.name} {landing.exam ? `${landing.exam} ` : ""}
            {landing.branch.name} özel ders
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-paper-800/75">
            {landing.city.name} içinde {examText}
            {landing.branch.name} öğretmeni arayan öğrenciler için hızlı yol: öğretmen profillerini
            karşılaştırın, kalite rozetlerini inceleyin, demo ders talep edin ve kabul sonrası canlı ders
            bağlantısıyla deneme oturumuna geçin. İsterseniz soru çözüm havuzu ve haftalık çalışma planıyla süreci
            ders dışında da takip edin.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              ["Öne çıkan öğretmen", stats.teacherCount ? `${stats.teacherCount}+` : "Talep aç"],
              ["Doğrulanmış profil", stats.verifiedCount ? `${stats.verifiedCount}` : "Filtrele"],
              ["Fiyat aralığı", stats.priceRange],
              ["Tamamlanan ders", stats.completedLessons ? `${stats.completedLessons}+` : "Profilde gör"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-paper-800/50">{label}</div>
                <div className="mt-1 text-sm font-semibold text-paper-950">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={teacherVerifiedHref}
              className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Doğrulanmış öğretmenleri listele
            </Link>
            <Link
              href={requestHref}
              className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
            >
              Talep oluştur
            </Link>
            <Link
              href={homeworkHref}
              className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-900 hover:bg-brand-100"
            >
              Soru çözüm havuzuna git
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Kaliteli profilleri karşılaştır", "Video, belge, yorum ve tamamlanan ders bilgilerini gör."],
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

        <section className="mt-8 rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-paper-900">
                Öne çıkan {landing.branch.name} öğretmenleri
              </h2>
              <p className="mt-1 text-sm text-paper-800/65">
                {landing.city.name} filtresiyle doğrulanmış ve güçlü profilleri önce gösteriyoruz.
              </p>
            </div>
            <Link href={teacherHref} className="text-sm font-semibold text-brand-800 underline underline-offset-4">
              Tüm öğretmenleri gör
            </Link>
          </div>
          {teachers.length === 0 ? (
            <p className="mt-4 rounded-xl bg-paper-50 p-4 text-sm text-paper-800/65">
              Bu filtrede öne çıkarılacak doğrulanmış öğretmen yoksa genel listeye gidip talep açabilirsiniz.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {teachers.map((teacher) => (
                <Link
                  key={teacher.id}
                  href={`/ogretmenler/${teacher.id}`}
                  className="rounded-xl border border-paper-200 bg-paper-50 p-4 transition hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-paper-900">{teacher.display_name}</h3>
                      <p className="mt-1 text-xs text-paper-800/55">
                        {teacher.primary_branch_name ?? landing.branch.name} · {priceLabel(teacher.min_hourly_rate_minor, teacher.max_hourly_rate_minor)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-900">
                          {teacher.verification_status === "verified" ? "Doğrulanmış" : teacher.verification_status}
                        </span>
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                          Profil {teacher.profile_quality_score ?? 0}/100
                        </span>
                        {teacher.completed_sessions_count > 0 ? (
                          <span className="rounded-full bg-paper-100 px-2 py-0.5 font-medium text-paper-800">
                            {teacher.completed_sessions_count} tamamlanan ders
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm text-paper-800/75">
                      {teacher.rating_count && Number(teacher.rating_count) > 0
                        ? `★ ${Number(teacher.rating_avg ?? 0).toFixed(1)} (${teacher.rating_count})`
                        : "Yeni profil"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-paper-900">
              {landing.city.name} içinde doğru öğretmeni seçmek
            </h2>
            <p className="mt-3 text-sm leading-6 text-paper-800/75">
              Sadece fiyatı değil, profil kalitesi, doğrulama durumu, ders tecrübesi ve öğrencinin hedef sınavını
              anlayan yaklaşımı birlikte değerlendirin. Tek talep açarak birden fazla öğretmenden teklif almak,
              karar süresini kısaltır.
            </p>
          </div>
          <div className="rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-paper-900">Ders dışı takip de önemli</h2>
            <p className="mt-3 text-sm leading-6 text-paper-800/75">
              Canlı sınıf kayıtları, materyaller, soru çözüm havuzu ve çalışma planı sayesinde özel ders sadece
              görüşme saatinden ibaret kalmaz. Veli paneli de ilerleme ve bildirimleri görünür tutar.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-paper-900">Sık sorulan sorular</h2>
          <div className="mt-4 divide-y divide-paper-100">
            {faq.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer text-sm font-semibold text-paper-900">{item.question}</summary>
                <p className="mt-2 text-sm leading-6 text-paper-800/70">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-brand-950">Hazır olduğunuzda tek talep yeter</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-brand-900/85">
            {landing.city.name} {landing.branch.name} özel ders için talep açın; öğretmenlerden gelen teklifleri
            karşılaştırıp sizin için doğru yolu seçin.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={requestHref} className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white">
              Talep oluştur
            </Link>
            <Link href={teacherVerifiedHref} className="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-900">
              Öğretmenleri incele
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
