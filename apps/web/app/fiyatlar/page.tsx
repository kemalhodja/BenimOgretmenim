import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";
import { RoleBasedPricing } from "./RoleBasedPricing";

const fiyatlarUrl = `${publicSiteUrl()}/fiyatlar`;

export const metadata: Metadata = {
  title: "Fiyatlandırma ve kullanım akışları",
  description: "Öğrenci, öğretmen ve veli için üyelik sonrası role özel abonelik ve kullanım akışları.",
  alternates: { canonical: fiyatlarUrl },
  openGraph: {
    title: "Fiyatlandırma ve kullanım akışları · BenimÖğretmenim",
    description: "Fiyatlar üyelikten sonra ilgili kullanıcı rolüne göre panel içinde gösterilir.",
    url: fiyatlarUrl,
    locale: "tr_TR",
    type: "website",
  },
};

const audiencePlans = [
  {
    title: "Öğrenci",
    price: "Fiyat öğrenci panelinde görünür",
    body: "Öğretmen arama, teklif karşılaştırma, soru çözüm havuzu, çalışma planı ve canlı sınıf akışları öğrenci panelinde birleşir.",
    href: "/kayit?role=student",
    cta: "Öğrenci hesabı aç",
  },
  {
    title: "Öğretmen",
    price: "Planlar öğretmen panelinde görünür",
    body: "Profil görünürlüğü, teklif verme, doğrudan ders, grup/kurs akışları ve soru çözüm havuzu ile gelir kanalı oluşturun.",
    href: "/kayit?role=teacher",
    cta: "Öğretmen olarak başvur",
  },
  {
    title: "Veli",
    price: "Takip hesabı",
    body: "Öğrencinin ders bildirimleri, çalışma planı ilerlemesi, deneme ortalaması ve canlı sınıf linklerini takip edin.",
    href: "/kayit?role=guardian",
    cta: "Veli hesabı aç",
  },
] as const;

const valuePillars = [
  {
    title: "Güvenli ödeme",
    body: "Ders, grup ders ve doğrudan anlaşmalarda ödeme kayıtlı ilerler; blokaj ve aktarım akışı görünür kalır.",
  },
  {
    title: "Operasyon paneli",
    body: "Talep, teklif, canlı sınıf, ödev, kurs ve bildirimler role göre tek panelde takip edilir.",
  },
  {
    title: "Öğrenme çıktısı",
    body: "Ders sonrası değerlendirme, çalışma planı, zayıf konu ve veli görünürlüğü fiyatın karşılığını ölçülebilir kılar.",
  },
] as const;

const conversionPromises = [
  "Demo ve teklif akışıyla öğretmen seçimi netleşir.",
  "Paket kabulünde ödeme ve ders adımları kayıtlı ilerler.",
  "Ders sonrası çalışma, ödev ve veli takibi ölçülebilir kalır.",
] as const;

const paymentTransparency = [
  {
    title: "Ne zaman ücret görünür?",
    body: "Öğretmen ücreti, paket, kurs, cüzdan yükleme veya abonelik tutarı ilgili panelde ödeme adımından önce gösterilir.",
  },
  {
    title: "Ödeme nasıl korunur?",
    body: "Kart ödemeleri PayTR üzerinden ilerler; cüzdan ve ders kayıtları admin mutabakat ve audit kayıtlarıyla izlenir.",
  },
  {
    title: "Sorun olursa ne olur?",
    body: "Tutar uyumsuzluğu, başarısız bildirim veya bilinmeyen ödeme referansı mutabakat kuyruğuna alınır ve manuel incelemeye açılır.",
  },
  {
    title: "İptal/iade nasıl değerlendirilir?",
    body: "Ders durumu, mesajlar, ödeme referansı, cüzdan hareketi ve platform kayıtları birlikte incelenerek sonuçlandırılır.",
  },
] as const;

export default function FiyatlarPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_88%_8%,rgba(255,122,77,0.12),transparent_30%),#f4fafc]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-paper-950 px-5 py-10 text-white shadow-[0_24px_90px_rgba(7,13,17,0.18)] sm:px-8">
          <div className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full bg-brand-300/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-warm-400/20 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl">
            <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-100">
              Role özel üyelik
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Üyelik ve kullanım akışları
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              Öğrenci, öğretmen ve veli için fiyatlar ilgili panelde gösterilir. Ders, ödeme ve takip adımları aynı
              yerde yönetilir.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/kayit?role=student" className="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-paper-950 hover:bg-brand-50">
                Öğrenci olarak başla
              </Link>
              <Link
                href="/kayit?role=teacher"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                Öğretmen başvurusu
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {valuePillars.map((pillar) => (
            <div key={pillar.title} className="rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-paper-900">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/70">{pillar.body}</p>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-paper-800/55">
                Değer karşılığı
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Ücret, sadece erişim değil; güvenli ders akışı ve takip altyapısı içindir.
              </h2>
            </div>
            <Link
              href="/uygulama"
              className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100"
            >
              Mobil kullanım
            </Link>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {conversionPromises.map((item, index) => (
              <li key={item} className="rounded-xl border border-paper-200 bg-paper-50 p-3 text-sm">
                <div className="text-xs font-semibold text-brand-900">Adım {index + 1}</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/70">{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-paper-800/55">
                Güven ve ücretlendirme
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Ödeme adımı sürprizsiz, kayıtlı ve incelenebilir ilerler.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                BenimÖğretmenim’de amaç yalnızca fiyat göstermek değil; ücretin hangi hizmete karşılık geldiğini,
                ödeme sonucunun nasıl kaydedildiğini ve sorun halinde nasıl incelendiğini açıkça göstermektir.
              </p>
            </div>
            <Link
              href="/kullanim-kosullari"
              className="w-fit rounded-xl border border-paper-200 bg-paper-50 px-3 py-2 text-xs font-semibold text-paper-900 hover:border-brand-200 hover:bg-brand-50"
            >
              Koşulları incele
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {paymentTransparency.map((item) => (
              <div key={item.title} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                <h3 className="text-sm font-semibold text-paper-900">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {audiencePlans.map((plan) => (
            <div key={plan.title} className="rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-paper-900">{plan.title}</h2>
              <p className="mt-1 text-sm font-medium text-brand-900">{plan.price}</p>
              <p className="mt-3 text-sm leading-relaxed text-paper-800/75">{plan.body}</p>
              <Link
                href={plan.href}
                className="mt-4 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-base font-semibold text-brand-950">Öğrenci için demo ders akışı</h2>
          <p className="mt-2 text-sm text-brand-900">
            Öğrenci öğretmen seçer, demo talebi gönderir, öğretmen yanıtlar ve kabul sonrası 30 dakikalık
            online demo oturumu oluşur. Demo sonrası paket, kurs veya ödev desteğine geçilebilir.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/ogretmenler"
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Öğretmen seç ve demo talep et
            </Link>
            <Link
              href="/student/requests"
              className="rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-100"
            >
              Taleplerim
            </Link>
          </div>
        </div>

        <RoleBasedPricing />

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/kayit?role=teacher" className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900">
            Öğretmen kaydı
          </Link>
          <Link
            href="/ogretmenler?verifiedOnly=1&sort=recommended"
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-900 hover:bg-brand-100"
          >
            Doğrulanmış öğretmenleri gör
          </Link>
          <Link
            href="/teacher"
            className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Öğretmen paneli
          </Link>
          <Link href="/" className="text-sm font-medium text-paper-800/65 underline-offset-4 hover:text-paper-900">
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
