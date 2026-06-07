import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HomeLaunchAnnouncement } from "./components/HomeLaunchAnnouncement";
import { HomeHeroPersonalized } from "./components/HomeHeroPersonalized";
import { HeroArt } from "./components/HeroArt";
import { StudentAudienceCard, TeacherAudienceCard } from "./components/marketing/AudienceCards";
import { RoleOrderedAudience } from "./components/RoleOrderedAudience";
import { publicSiteUrl } from "./lib/siteUrl";

/** Ana sayfa hero — Unsplash (ücretsiz kullanım; altta atıf) */
const HERO_PHOTO =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=960&q=80";

const HOME_OG_DESCRIPTION =
  "Özel ders, soru çözüm, canlı sınıf, güvenli ödeme ve veli takibini tek panelde yönetin.";

export const metadata: Metadata = {
  alternates: { canonical: `${publicSiteUrl()}/` },
  openGraph: {
    type: "website",
    url: publicSiteUrl(),
    title: "BenimÖğretmenim — özel ders",
    description: HOME_OG_DESCRIPTION,
    images: [
      {
        url: HERO_PHOTO,
        width: 960,
        height: 640,
        alt: "Öğretmen ve öğrenciler",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BenimÖğretmenim",
    description: HOME_OG_DESCRIPTION,
  },
};

const quickSubjects = ["LGS Matematik", "YKS Fizik", "İngilizce konuşma", "İlkokul destek"] as const;

const heroSignals = ["Akıllı eşleşme", "Canlı sınıf", "Güvenli ödeme", "Veli görünürlüğü"] as const;

const homeQuickActions = [
  {
    title: "Öğretmen ara",
    body: "Branş, şehir, doğrulama ve puana göre öğretmenleri listeleyin.",
    href: "/ogretmenler?verifiedOnly=1&sort=recommended",
  },
  {
    title: "Soru / ödev gönder",
    body: "Fotoğraflı sorunuzu konu, sınav hedefi ve aciliyetle havuza bırakın.",
    href: "/student/odev-sor",
  },
  {
    title: "Çalışma planı",
    body: "Haftalık hedefleri, deneme sonuçlarını ve zayıf konuları takip edin.",
    href: "/student/calisma",
  },
  {
    title: "Öğretmen olun",
    body: "Profilinizi oluşturun, taleplere teklif verin ve soru havuzuna katılın.",
    href: "/kayit?role=teacher",
  },
] as const;

const platformTracks = [
  {
    title: "Öğretmen seçimi",
    body: "Öğretmenleri doğrulama, deneyim, puan ve ders ücretine göre karşılaştırın.",
    href: "/student/requests",
  },
  {
    title: "Hızlı soru çözüm",
    body: "Fotoğraflı sorular konu, sınav hedefi ve aciliyet bilgisiyle doğru öğretmene ulaşır.",
    href: "/student/odev-sor",
  },
  {
    title: "Canlı ders düzeni",
    body: "Ders odası, ortak tahta, mesajlar, materyaller ve kayıt linkleri tek yerde kalır.",
    href: "/student/dersler",
  },
  {
    title: "İlerleme takibi",
    body: "Haftalık plan, deneme sonuçları, zayıf konu takibi ve veli görünürlüğü birlikte ilerler.",
    href: "/student/calisma",
  },
] as const;

const homeActionCards = [
  {
    title: "Öğrenciyim",
    body: "Öğretmen bul, teklif topla, soru gönder veya çalışma planını takip et.",
    href: "/kayit?role=student",
    cta: "Öğrenci hesabı aç",
  },
  {
    title: "Öğretmenim",
    body: "Profilini güçlendir, taleplere teklif ver, soru havuzundan gelir oluştur.",
    href: "/kayit?role=teacher",
    cta: "Öğretmen başvurusu",
  },
  {
    title: "Veliyim",
    body: "Öğrencinin derslerini, bildirimlerini ve çalışma ilerlemesini takip et.",
    href: "/kayit?role=guardian",
    cta: "Veli hesabı aç",
  },
] as const;

const homeHighlights: {
  title: string;
  body: string;
  icon: "scale" | "chat" | "users" | "card";
}[] = [
  { title: "Teklifler", body: "Birden çok öğretmenden seçim", icon: "scale" },
  { title: "Mesaj", body: "Talep üzerinden iletişim", icon: "chat" },
  { title: "Veli", body: "Özet ve bildirimler", icon: "users" },
  { title: "Ödeme", body: "Kart veya havale", icon: "card" },
];

const avantPreviewCards = [
  { label: "Canlı ders", value: "20:30", hint: "Tahta + kayıt hazır" },
  { label: "Soru SLA", value: "10 dk", hint: "Acil havuz öncelikli" },
  { label: "Plan", value: "%72", hint: "Haftalık ilerleme" },
] as const;

const commandDeckCards = [
  {
    eyebrow: "01",
    title: "Eşleşme ve talep motoru",
    body: "Öğrenci ihtiyacını branş, şehir, demo, kısa liste ve öğretmen kalite sinyalleriyle profesyonel bir seçim akışına çevirir.",
    metric: "3 teklif",
    metricLabel: "karşılaştırılabilir",
  },
  {
    eyebrow: "02",
    title: "Canlı ders operasyonu",
    body: "Paket, oturum, sınıf linki, mesaj, materyal, kayıt ve ders sonu değerlendirme aynı operasyon hattında ilerler.",
    metric: "1 panel",
    metricLabel: "tüm ders yaşam döngüsü",
  },
  {
    eyebrow: "03",
    title: "Öğrenme ve veli görünürlüğü",
    body: "Haftalık plan, zayıf konu, ödev çözüm, bildirim ve veli bağlantısı öğrencinin ilerlemesini izlenebilir kılar.",
    metric: "%72",
    metricLabel: "örnek plan ilerlemesi",
  },
] as const;

const commandTimeline = [
  "Öğrenci talebi açar",
  "Öğretmenler teklif verir",
  "Ödeme blokajı güvenceye alınır",
  "Canlı sınıf ve gelişim özeti oluşur",
] as const;

const socialProofStats = [
  { value: "4 akış", label: "özel ders, soru çözüm, canlı sınıf, çalışma takibi" },
  { value: "10 dk", label: "acil soru çözüm hedef SLA örneği" },
  { value: "3 rol", label: "öğrenci, öğretmen ve veli paneli" },
] as const;

const leadershipStandards = [
  {
    title: "Güven",
    body: "Doğrulanmış profil, kalite skoru, yorumlar ve güvenli ödeme akışı karar öncesi görünür olur.",
    href: "/ogretmenler?verifiedOnly=1&sort=recommended",
  },
  {
    title: "Şeffaflık",
    body: "Teklif, paket, cüzdan blokajı, canlı ders ve ders sonu takip aynı kayıtlı süreçte ilerler.",
    href: "/student/requests",
  },
  {
    title: "Ölçülebilir başarı",
    body: "Çalışma planı, zayıf konu, ödev kalitesi ve veli görünürlüğü öğrenme sonucunu takip edilebilir kılar.",
    href: "/student/calisma",
  },
] as const;

const trustQuotes = [
  {
    quote: "Öğretmeni aramak, soru göndermek ve çalışma planını izlemek aynı yerde olmalıydı.",
    source: "Öğrenci deneyimi",
  },
  {
    quote: "Profil kalitesi, doğrulama ve yanıt hızı görünür olunca doğru öğretmeni seçmek kolaylaşıyor.",
    source: "Veli güven katmanı",
  },
] as const;

const successStories = [
  {
    role: "Öğrenci",
    title: "LGS hedefi için doğru öğretmeni seçme",
    body: "Öğrenci önce doğrulanmış matematik profillerini karşılaştırır, kısa liste oluşturur ve tek taleple teklif toplar.",
    action: "Öğretmen sihirbazını aç",
    href: "/ogretmenler?verifiedOnly=1&sort=recommended&q=LGS%20Matematik",
  },
  {
    role: "Öğretmen",
    title: "Profil kalitesini görünürlüğe çevirme",
    body: "Öğretmen video, belge, branş ve ders sonrası notları tamamladıkça kalite programında net aksiyon görür.",
    action: "Öğretmen başvurusu",
    href: "/kayit?role=teacher",
  },
  {
    role: "Veli",
    title: "Haftalık risk ve ilerleme takibi",
    body: "Veli ders, soru, öğretmen notu ve çalışma sinyalini tek raporda takip eder; risk varsa aksiyonu görür.",
    action: "Veli hesabı aç",
    href: "/kayit?role=guardian",
  },
] as const;

const howSteps = [
  {
    step: "1",
    title: "İhtiyacınızı seçin",
    body: "Öğretmen arayın, soru gönderin veya çalışma planınızı açın.",
  },
  {
    step: "2",
    title: "Doğru akışa gidin",
    body: "Öğrenci, öğretmen ve veli hesapları farklı panellere yönlenir.",
  },
  {
    step: "3",
    title: "Panelden takip edin",
    body: "Ders, ödeme, bildirim, soru ve ilerleme bilgileri tek yerde kalır.",
  },
] as const;

function HighlightIcon({ name }: { name: (typeof homeHighlights)[number]["icon"] }) {
  const cls = "h-4 w-4";
  switch (name) {
    case "scale":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      );
    case "chat":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a3 3 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "card":
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
  }
}

export default function Home() {
  return (
    <div className="bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(255,122,77,0.14),transparent_30%),linear-gradient(180deg,#f4fafc_0%,#f6fafc_42%,#ffffff_100%)]">
      <HomeLaunchAnnouncement />
      <section className="relative overflow-hidden border-b border-white/10 bg-paper-950 text-white">
        <HeroArt />
        <div
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(115deg,rgba(34,211,238,0.18),transparent_30%),linear-gradient(245deg,rgba(255,122,77,0.18),transparent_32%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08),transparent_34%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:36px_36px]"
          aria-hidden
        />
        <div className="relative z-0 mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_min(44%,min(440px,100%))] lg:items-center lg:gap-12">
            <div className="max-lg:order-2 lg:order-none">
              <p className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-brand-100 shadow-[0_0_32px_rgba(34,211,238,0.18)] backdrop-blur">
                Dijital eğitim merkezi
              </p>
              <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-[2.7rem] sm:leading-[1.05]">
                Özel dersi kurumsal kaliteyle yöneten dijital eğitim merkezi
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80">
                Öğretmen arama, teklif karşılaştırma, canlı sınıf, soru çözüm, güvenli ödeme ve veli takibi tek
                profesyonel akışta birleşir.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {heroSignals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  >
                    {signal}
                  </span>
                ))}
              </div>
              <form
                action="/ogretmenler"
                className="mt-6 rounded-3xl border border-white/15 bg-white/[0.08] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100/75">
                  Hızlı öğretmen arama
                </div>
                <div className="mt-2 sm:flex sm:items-center sm:gap-2">
                  <label className="sr-only" htmlFor="home-teacher-search">
                    Ders veya sınav ara
                  </label>
                  <input
                    id="home-teacher-search"
                    name="q"
                    type="search"
                    placeholder="Örn. LGS matematik, İngilizce konuşma"
                    className="w-full rounded-2xl border border-white/15 bg-white/95 px-4 py-3 text-sm text-paper-950 outline-none ring-brand-300 placeholder:text-paper-800/50 focus:ring-2"
                  />
                  <button
                    type="submit"
                    className="mt-2 w-full rounded-2xl bg-gradient-to-r from-brand-300 via-brand-400 to-warm-400 px-5 py-3 text-sm font-bold text-paper-950 shadow-[0_12px_42px_rgba(34,211,238,0.32)] hover:brightness-105 sm:mt-0 sm:w-auto"
                  >
                    Ara
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickSubjects.map((label) => (
                    <Link
                      key={label}
                      href={`/ogretmenler?q=${encodeURIComponent(label)}`}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:border-brand-200 hover:bg-white/15"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </form>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/kayit?role=student"
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-paper-950 shadow-[0_14px_45px_rgba(255,255,255,0.16)] hover:bg-brand-50"
                >
                  Öğrenci olarak başla
                </Link>
                <Link
                  href="/ogretmenler?verifiedOnly=1&sort=recommended"
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
                >
                  Öğretmenleri keşfet
                </Link>
                <Link
                  href="/kayit?role=teacher"
                  className="rounded-2xl border border-warm-300/40 bg-warm-400/15 px-4 py-2.5 text-sm font-semibold text-warm-100 hover:bg-warm-400/20"
                >
                  Öğretmen başvurusu
                </Link>
              </div>
              <HomeHeroPersonalized />
              <dl className="mt-10 grid grid-cols-2 gap-3 border-t border-white/10 pt-10 sm:grid-cols-4 sm:gap-4">
                {homeHighlights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-brand-100 ring-1 ring-white/10">
                      <HighlightIcon name={item.icon} />
                    </div>
                    <dt className="mt-2 text-sm font-semibold text-white">{item.title}</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-white/60">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <figure className="order-first mx-auto w-full max-w-md lg:order-none lg:mx-0 lg:max-w-none">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] p-3 shadow-[0_30px_110px_rgba(0,0,0,0.38)] backdrop-blur-xl">
                <div className="relative h-full min-h-0 w-full overflow-hidden rounded-[1rem]">
                  <Image
                    src={HERO_PHOTO}
                    alt="Grup ders çalışması: öğrenciler birlikte not tutuyor"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 440px"
                    priority
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-paper-950/90 via-paper-950/30 to-brand-300/15" />
                  <div className="absolute left-4 top-4 rounded-2xl border border-white/15 bg-paper-950/60 px-4 py-3 text-white shadow-2xl backdrop-blur">
                    <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-brand-100/75">
                      Bugünün paneli
                    </div>
                    <div className="mt-1 text-xl font-semibold">3 akış hazır</div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:grid-cols-3">
                    {avantPreviewCards.map((card) => (
                      <div key={card.label} className="rounded-2xl border border-white/15 bg-white/10 p-3 text-white backdrop-blur-md">
                        <div className="text-[0.65rem] uppercase tracking-wide text-white/60">{card.label}</div>
                        <div className="mt-1 text-lg font-semibold">{card.value}</div>
                        <div className="mt-1 text-[0.68rem] leading-tight text-white/60">{card.hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute -right-7 top-1/3 h-24 w-24 rounded-full bg-brand-300/25 blur-2xl" aria-hidden />
                <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-warm-400/25 blur-2xl" aria-hidden />
              </div>
              <figcaption className="mt-2 text-center text-[0.65rem] leading-snug text-white/50 lg:text-left">
                Fotoğraf:{" "}
                <a
                  href="https://unsplash.com/@brookecagle?utm_source=benimogretmenim&utm_medium=referral"
                  className="underline decoration-white/30 underline-offset-2 hover:text-brand-100"
                  target="_blank"
                  rel="noreferrer"
                >
                  Brooke Cagle
                </a>{" "}
                /{" "}
                <a
                  href="https://unsplash.com/license?utm_source=benimogretmenim&utm_medium=referral"
                  className="underline decoration-white/30 underline-offset-2 hover:text-brand-100"
                  target="_blank"
                  rel="noreferrer"
                >
                  Unsplash Lisansı
                </a>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="border-b border-paper-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-800/70">
                Türkiye için liderlik standardı
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-900">
                Güven, şeffaflık ve ölçülebilir öğrenme aynı yerde
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                BenimÖğretmenim sadece öğretmen listesi değil; doğru öğretmeni seçme, dersi güvenle başlatma ve sonucu takip etme merkezidir.
              </p>
            </div>
            <Link
              href="/uygulama"
              className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-100"
            >
              Telefona ekle
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {leadershipStandards.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-paper-200 bg-paper-50 p-5 transition hover:border-brand-200 hover:bg-white"
              >
                <h3 className="text-base font-semibold text-paper-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-800/70">{item.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-paper-200 bg-paper-950 py-14 text-white sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.2),transparent_24%),radial-gradient(circle_at_86%_8%,rgba(255,122,77,0.18),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-brand-200/20 bg-brand-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-100">
                Profesyonel ürün katmanı
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Ders sürecini tek yerden yönetin
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">
                Talep, teklif, ödeme, canlı ders ve takip adımları tek akışta birleşir.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    Canlı akış
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">Ders yaşam döngüsü</div>
                </div>
                <div className="rounded-full border border-brand-200/25 bg-brand-300/10 px-3 py-1 text-xs font-semibold text-brand-100">
                  Online
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {commandTimeline.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-paper-950/60 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-300 to-warm-400 text-xs font-bold text-paper-950">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-white/85">{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {commandDeckCards.map((card) => (
              <article
                key={card.title}
                className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-brand-200/40 hover:bg-white/[0.08]"
              >
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-300/10 blur-2xl transition group-hover:bg-warm-300/15" />
                <div className="relative">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-100/65">
                    {card.eyebrow}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{card.body}</p>
                  <div className="mt-6 rounded-2xl border border-white/10 bg-paper-950/70 p-4">
                    <div className="text-2xl font-semibold text-white">{card.metric}</div>
                    <div className="mt-1 text-xs text-white/50">{card.metricLabel}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-paper-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-[2rem] border border-paper-200 bg-[linear-gradient(135deg,#ffffff_0%,#f4fafc_55%,#fff7f3_100%)] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-800/70">
                  Güven sinyalleri
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-900">
                  Takip edilebilir eğitim deneyimi
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                  Platform, öğrencinin ilk aramasından ders sonrası ilerleme takibine kadar görünür ve kayıtlı bir
                  akış üretir. Temel fiyatlar şeffaftır; kişisel ödeme, cüzdan ve hakediş detayları ilgili panelde
                  güvenli şekilde yönetilir.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
                {socialProofStats.map((stat) => (
                  <div key={stat.value} className="rounded-2xl border border-paper-200 bg-white p-4">
                    <div className="text-2xl font-semibold text-paper-950">{stat.value}</div>
                    <div className="mt-1 text-xs leading-relaxed text-paper-800/60">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {trustQuotes.map((item) => (
                <figure key={item.source} className="rounded-2xl border border-paper-200 bg-white/80 p-4">
                  <blockquote className="text-sm leading-relaxed text-paper-800">“{item.quote}”</blockquote>
                  <figcaption className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-800/70">
                    {item.source}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {successStories.map((story) => (
                <Link
                  key={story.title}
                  href={story.href}
                  className="group rounded-2xl border border-paper-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-800/70">{story.role}</div>
                  <h3 className="mt-2 text-base font-semibold text-paper-950">{story.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper-800/65">{story.body}</p>
                  <span className="mt-4 inline-flex text-sm font-semibold text-brand-800 transition group-hover:translate-x-1">
                    {story.action} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-paper-200 bg-paper-50 py-10">
        <div className="pointer-events-none absolute -left-24 top-8 h-48 w-48 rounded-full bg-brand-200/35 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-52 w-52 rounded-full bg-warm-200/35 blur-3xl" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-paper-900">En hızlı başlangıç</h2>
              <p className="mt-1 text-sm text-paper-800/70">
                Ana menüde kaybolmadan doğrudan yapmak istediğiniz işe gidin.
              </p>
            </div>
            <Link href="/fiyatlar" className="text-sm font-semibold text-brand-800 underline underline-offset-4">
              Şeffaf fiyatları incele
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {homeQuickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group relative overflow-hidden rounded-[1.4rem] border border-paper-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_22px_60px_rgba(10,102,128,0.14)]"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-300 via-white to-warm-300 opacity-80" />
                <h3 className="text-base font-semibold text-paper-900">{action.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-800/70">{action.body}</p>
                <span className="mt-4 inline-flex text-sm font-semibold text-brand-800 transition group-hover:translate-x-1">
                  Başla →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-paper-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-paper-900">Hangi hesap size uygun?</h2>
              <p className="mt-1 text-sm text-paper-800/70">
                Kayıt sonrası her rol kendi paneline gider; fiyat ve abonelik bilgileri sadece ilgili kişiye görünür.
              </p>
            </div>
            <Link href="/login" className="text-sm font-semibold text-brand-800 underline underline-offset-4">
              Hesabım var, giriş yap
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {homeActionCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-[1.5rem] border border-paper-200 bg-[linear-gradient(135deg,#ffffff_0%,#f4fafc_62%,#ecfeff_100%)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_22px_70px_rgba(10,102,128,0.12)]"
              >
                <div className="mb-4 h-10 w-10 rounded-2xl bg-paper-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]">
                  <div className="h-full w-full rounded-2xl bg-[radial-gradient(circle_at_25%_25%,#67e8f9,transparent_35%),radial-gradient(circle_at_78%_70%,#ff7a4d,transparent_34%)]" />
                </div>
                <h3 className="text-lg font-semibold text-paper-900">{card.title}</h3>
                <p className="mt-2 min-h-[3rem] text-sm leading-relaxed text-paper-800/70">{card.body}</p>
                <span className="mt-4 inline-flex rounded-2xl bg-paper-950 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-brand-800">
                  {card.cta}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="nasil" className="scroll-mt-20 border-b border-paper-200 bg-paper-950 py-14 text-white sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Nasıl kullanılır?</h2>
          <p className="mt-2 max-w-xl text-sm text-white/70">
            Platformu kullanmak için önce amacınızı seçin, sonra tüm işlemleri kendi panelinizden takip edin.
          </p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {howSteps.map((item) => (
              <li key={item.step} className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-300 to-warm-400 text-sm font-bold text-paper-950">
                  {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/70">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-paper-200 bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-paper-900 sm:text-3xl">
                Platformda neler var?
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-paper-800/75">
                Özel ders, soru çözüm, canlı sınıf ve çalışma takibi ayrı ayrı da kullanılabilir; hepsi aynı hesap
                yapısında birleşir.
              </p>
            </div>
            <Link href="/fiyatlar" className="text-sm font-semibold text-brand-800 underline underline-offset-4">
              Üyelik akışını gör
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {platformTracks.map((track) => (
              <Link
                key={track.title}
                href={track.href}
                className="group rounded-[1.5rem] border border-paper-200 bg-paper-50 p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-[0_22px_70px_rgba(10,102,128,0.12)]"
              >
                <h3 className="text-base font-semibold text-paper-900">{track.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-800/75">{track.body}</p>
                <span className="mt-4 inline-flex text-sm font-semibold text-brand-800 transition group-hover:translate-x-1">
                  İncele →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <RoleOrderedAudience
          studentSlot={<StudentAudienceCard />}
          teacherSlot={<TeacherAudienceCard />}
        />
      </section>

      <section className="border-t border-paper-200 bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-paper-200 bg-paper-950 px-5 py-10 text-white shadow-[0_30px_100px_rgba(7,13,17,0.18)] sm:px-10">
            <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-brand-300/25 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 -right-14 h-52 w-52 rounded-full bg-warm-400/25 blur-3xl" aria-hidden />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Nereden başlayacağınızı seçin</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                Öğrenciyseniz öğretmen arayın veya soru gönderin; öğretmenseniz başvuru yapın. Temel fiyatlar
                şeffaftır, kişisel ödeme ve hakediş detayları ilgili panelde yönetilir.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/kayit?role=student"
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-paper-950 hover:bg-brand-50"
                >
                  Ücretsiz kayıt ol
                </Link>
                <Link
                  href="/fiyatlar"
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Üyelik akışlarını gör
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
