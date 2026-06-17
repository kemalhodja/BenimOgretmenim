import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";
import { RoleBasedPricing } from "./RoleBasedPricing";

const fiyatlarUrl = `${publicSiteUrl()}/fiyatlar`;

export const metadata: Metadata = {
  title: "Fiyatlar ve kullanım bilgileri",
  description: "Öğrenci yıllık aboneliği, öğretmen erken erişim paketleri ve kampanya ilan ücretleri.",
  alternates: { canonical: fiyatlarUrl },
  openGraph: {
    title: "Fiyatlar ve kullanım bilgileri · BenimÖğretmenim",
    description: "Öğrenci, öğretmen ve veli için fiyatlar, haklar ve ödeme bilgileri.",
    url: fiyatlarUrl,
    locale: "tr_TR",
    type: "website",
  },
};

const audiencePlans = [
  {
    title: "Öğrenci",
    price: "Ücretsiz kullanım var · yıllık abonelik 1500 TL",
    comparePrice: "12.000 TL",
    campaignNote: "Bugün ödeyeceğiniz tutar değişmez. Üstü çizili tutar sadece karşılaştırma bilgisidir.",
    body: "Abonelik, daha fazla öğretmene ulaşmak ve takıldığınız soruları bekletmeden çözmek içindir.",
    why: [
      "Günlük 1 ders ilanı yerine 5 ders ilanı açın; daha çok öğretmenden teklif alın.",
      "Günlük 5 soru yerine 10 soru gönderin; ödev ve sınav hazırlığında tıkanmayın.",
      "Demo, teklif, cüzdan, ders ve çalışma takibini tek öğrenci panelinde görün.",
    ],
    href: "/kayit?role=student",
    cta: "Öğrenci hesabı aç",
  },
  {
    title: "Öğretmen",
    price: "1750 TL / 30 ay · 2500 TL / 60 ay",
    comparePrice: "14.000 TL / 6 ay · 20.000 TL / 12 ay",
    campaignNote: "Erken erişim hediyesi: 6 ay aboneliğe 24 ay, 12 ay aboneliğe 48 ay ücretsiz hediye süre. 9 Eylül’e kadar veya ilk 500 öğretmen dolana kadar geçerlidir.",
    body: "Abonelik, öğretmenin görünürlük, teklif ve reklam gücünü açar; profiliniz satış sayfası gibi çalışır.",
    why: [
      "Sınırsız teklif verin; abonesizken günde yalnızca 1 normal teklif ücretsizdir.",
      "Public profiliniz tam açılır: bio, video, kanıtlar, fiyat, telefon ve WhatsApp tercihi görünür.",
      "Profil linkinizi kendi web sayfanız gibi paylaşın; ilk kampanya ilanı ücretsizdir.",
    ],
    href: "/kayit?role=teacher",
    cta: "Öğretmen olarak başvur",
  },
  {
    title: "Veli",
    price: "Takip hesabı",
    body: "Veli hesabı ödeme yapan ayrı bir plan değil; öğrencinin abonelik ve ders sürecini görünür kılan takip katmanıdır.",
    why: [
      "Çocuğunuzun ders, ödev, canlı sınıf ve çalışma planı özetini görün.",
      "Ödeme, destek ve ders kayıtları gerektiğinde takip edilebilir kalsın.",
      "Öğrenci aboneliğiyle açılan yoğun kullanım haklarının neye dönüştüğünü izleyin.",
    ],
    href: "/kayit?role=guardian",
    cta: "Veli hesabı aç",
  },
] as const;

const valuePillars = [
  {
    title: "Güvenli ödeme",
    body: "Ödeme kayıtlı ilerler. Tutarın ne zaman tutulduğu ve ne zaman aktarıldığı panelde görünür.",
  },
  {
    title: "Tek panel",
    body: "Talep, teklif, canlı ders, ödev, kurs ve bildirimler role göre tek panelde görünür.",
  },
  {
    title: "Gelişim takibi",
    body: "Ders sonrası not, çalışma planı, eksik konu ve veli bildirimi gelişimi takip etmeyi kolaylaştırır.",
  },
] as const;

const conversionPromises = [
  "Demo ve teklifler öğretmen seçimini netleştirir.",
  "Paket kabulünde ödeme ve ders adımları kayıtlı ilerler.",
  "Ders sonrası çalışma, ödev ve veli takibi görünür kalır.",
] as const;

const subscriptionDecisionCards = [
  {
    title: "Öğrenci neden abone olur?",
    body: "Daha çok ilan ve soru hakkı sayesinde tek öğretmene mahkum kalmaz; daha fazla seçenek, daha hızlı çözüm ve daha düzenli takip kazanır.",
  },
  {
    title: "Öğretmen neden abone olur?",
    body: "Profilini kapalı bir karttan çıkarıp paylaşılabilir satış sayfasına çevirir; sınırsız teklif, tam görünürlük ve reklam hakkı kazanır.",
  },
  {
    title: "Veli için değer nedir?",
    body: "Ders, ödeme, ödev ve ilerleme bilgisi dağılmaz; veli öğrencinin abonelikten aldığı faydayı panelde takip eder.",
  },
] as const;

const paymentTransparency = [
  {
    title: "Ne zaman ücret görünür?",
    body: "Öğretmen ücreti, paket, kurs, cüzdan yükleme veya abonelik tutarı ilgili panelde ödeme adımından önce gösterilir.",
  },
  {
    title: "Ödeme nasıl korunur?",
    body: "Kart ödemeleri güvenli ödeme altyapısıyla alınır. Cüzdan ve ders kayıtları yönetici tarafından kontrol edilebilir.",
  },
  {
    title: "Sorun olursa ne olur?",
    body: "Tutar uyuşmazlığı veya başarısız ödeme olursa kayıt yönetici incelemesine alınır.",
  },
  {
    title: "İptal/iade nasıl değerlendirilir?",
    body: "Ders durumu, mesajlar, ödeme referansı, cüzdan hareketi ve platform kayıtları birlikte incelenerek sonuçlandırılır.",
  },
] as const;

export default function FiyatlarPage() {
  return (
    <div className="bo-edu-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-edu-indigo-900 bg-edu-indigo-950 px-5 py-10 text-white shadow-[0_24px_90px_rgba(30,27,75,0.22)] sm:px-8">
          <div className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full bg-edu-blue-400/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-edu-sun-300/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute left-1/2 top-20 h-36 w-36 rounded-full bg-edu-success-300/15 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl">
            <p className="inline-flex rounded-full border border-edu-blue-200/25 bg-edu-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-edu-blue-100">
              Role özel üyelik · eğitim hakları
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Üyelik ve kullanım bilgileri
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              Sadece fiyat değil, abonelikle ne kazanacağınız da açıktır. Öğrenci daha fazla hak, öğretmen daha fazla
              görünürlük, veli ise daha net takip kazanır.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/kayit?role=student" className="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-edu-indigo-950 hover:bg-edu-blue-50">
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
            <div key={pillar.title} className="rounded-2xl border border-edu-blue-100 bg-white/92 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-paper-900">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/70">{pillar.body}</p>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-edu-blue-100 bg-white/94 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-edu-indigo-700/70">
                Değer karşılığı
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Ücret, sadece giriş için değil; güvenli ödeme, ders ve takip araçları içindir.
              </h2>
            </div>
            <Link
              href="/uygulama"
              className="w-fit rounded-xl border border-edu-indigo-200 bg-edu-indigo-50 px-3 py-2 text-xs font-semibold text-edu-indigo-800 hover:bg-edu-indigo-100"
            >
              Mobil kullanım
            </Link>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {conversionPromises.map((item, index) => (
              <li key={item} className="rounded-xl border border-edu-blue-100 bg-edu-blue-50/65 p-3 text-sm">
                <div className="text-xs font-semibold text-edu-indigo-800">Adım {index + 1}</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/70">{item}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 rounded-2xl border border-edu-blue-100 bg-white/94 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-edu-indigo-700/70">
                Güven ve ücretlendirme
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Ödeme adımı sürprizsiz, kayıtlı ve incelenebilir ilerler.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                BenimÖğretmenim’de amaç yalnızca fiyat göstermek değil; ücretin hangi hizmete karşılık geldiğini,
                ödeme sonucunun nerede göründüğünü ve sorun halinde nasıl incelendiğini açıkça göstermektir.
              </p>
            </div>
            <Link
              href="/kullanim-kosullari"
              className="w-fit rounded-xl border border-edu-blue-100 bg-edu-blue-50 px-3 py-2 text-xs font-semibold text-paper-900 hover:border-edu-indigo-200 hover:bg-white"
            >
              Koşulları incele
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {paymentTransparency.map((item) => (
              <div key={item.title} className="rounded-xl border border-edu-blue-100 bg-edu-blue-50/65 p-3">
                <h3 className="text-sm font-semibold text-paper-900">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bo-edu-card mt-8 rounded-[2rem] border border-edu-indigo-200 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-edu-indigo-700/70">
            Neden abone olmalıyım?
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-950">
            Abonelik, kullanım hakkını ve güven veren görünürlüğü artırır.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-paper-800/70">
            Öğrenci için daha fazla deneme ve soru hakkı, öğretmen için daha çok müşteri adayı ve profesyonel vitrin,
            veli için daha anlaşılır takip demektir.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {subscriptionDecisionCards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-white bg-white/88 p-4 shadow-sm">
                <h3 className="text-base font-semibold text-paper-950">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-800/70">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {audiencePlans.map((plan) => (
            <div key={plan.title} className="rounded-2xl border border-edu-blue-100 bg-white/94 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-edu-indigo-200 hover:shadow-[0_22px_70px_rgba(79,70,229,0.12)]">
              <h2 className="text-lg font-semibold text-paper-900">{plan.title}</h2>
              {"comparePrice" in plan ? (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-paper-800/45">
                  <span className="line-through">{plan.comparePrice}</span>
                </p>
              ) : null}
              <p className="mt-1 text-sm font-medium text-edu-indigo-800">{plan.price}</p>
              {"campaignNote" in plan ? (
                <p className="mt-2 rounded-xl border border-edu-sun-300 bg-edu-sun-50 px-3 py-2 text-xs font-semibold leading-relaxed text-edu-sun-900">
                  {plan.campaignNote}
                </p>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-paper-800/75">{plan.body}</p>
              <div className="mt-4 rounded-xl border border-edu-indigo-100 bg-edu-indigo-50/80 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-edu-indigo-800/70">
                  Abonelikle kazanılanlar
                </div>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-edu-indigo-950">
                  {plan.why.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-edu-success-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={plan.href}
                className="mt-4 inline-flex rounded-xl bg-edu-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-edu-indigo-800"
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-edu-success-100 bg-edu-success-50 p-5">
          <h2 className="text-base font-semibold text-edu-success-900">Öğrenci için demo ders süreci</h2>
          <p className="mt-2 text-sm text-edu-success-900/80">
            Öğrenci öğretmen seçer, demo talebi gönderir, öğretmen yanıtlar ve kabul sonrası 30 dakikalık
            online demo oturumu oluşur. Demo sonrası paket, kurs veya ödev desteğine geçilebilir.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/ogretmenler"
              className="rounded-xl bg-edu-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-edu-indigo-800"
            >
              Öğretmen seç ve demo talep et
            </Link>
            <Link
              href="/student/requests"
              className="rounded-xl border border-edu-success-100 bg-white px-4 py-2 text-sm font-medium text-edu-success-900 hover:bg-edu-success-50"
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
