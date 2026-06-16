import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLockup } from "./components/BrandLockup";
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
    body: "Branş, şehir, ücret ve yorumlara göre öğretmen bulun.",
    href: "/ogretmenler?verifiedOnly=1&sort=recommended",
  },
  {
    title: "Soru / ödev gönder",
    body: "Sorunuzu fotoğrafla gönderin. Uygun öğretmen görsün.",
    href: "/student/odev-sor",
  },
  {
    title: "Çalışma planı",
    body: "Hedeflerinizi, denemelerinizi ve eksik konularınızı görün.",
    href: "/student/calisma",
  },
  {
    title: "Öğretmen olun",
    body: "Profil açın, öğrenci taleplerine cevap verin.",
    href: "/kayit?role=teacher",
  },
] as const;

const platformTracks = [
  {
    title: "Öğretmen seçimi",
    body: "Öğretmenleri deneyim, yorum, ücret ve doğrulama bilgisiyle karşılaştırın.",
    href: "/student/requests",
  },
  {
    title: "Hızlı soru çözüm",
    body: "Fotoğraflı sorunuz doğru branştaki öğretmenlere ulaşır.",
    href: "/student/odev-sor",
  },
  {
    title: "Canlı ders düzeni",
    body: "Ders bağlantısı, tahta, mesaj ve materyaller tek yerde kalır.",
    href: "/student/dersler",
  },
  {
    title: "İlerleme takibi",
    body: "Plan, deneme sonucu, eksik konu ve veli bildirimi birlikte görünür.",
    href: "/student/calisma",
  },
] as const;

const homeActionCards = [
  {
    title: "Öğrenciyim",
    body: "Ücretsiz başlayın; yıllık abonelikle günlük 5 ders ilanı ve 10 soru hakkına çıkın.",
    href: "/kayit?role=student",
    cta: "Öğrenci hesabı aç",
  },
  {
    title: "Öğretmenim",
    body: "Abonelikle profilinizi web sayfası gibi açın, sınırsız teklif verin ve kampanya yayınlayın.",
    href: "/kayit?role=teacher",
    cta: "Öğretmen başvurusu",
  },
  {
    title: "Veliyim",
    body: "Öğrencinin ders, ödeme, soru ve abonelikten doğan hak kullanımını tek panelden takip edin.",
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
  { label: "Soru yanıtı", value: "10 dk", hint: "Acil sorular öne çıkar" },
  { label: "Plan", value: "%72", hint: "Haftalık ilerleme" },
] as const;

const commandDeckCards = [
  {
    eyebrow: "01",
    title: "Doğru öğretmeni bulma",
    body: "Öğrenci öğretmenleri branş, şehir, ücret, yorum ve doğrulama bilgisiyle yan yana görür.",
    metric: "3 teklif",
    metricLabel: "karşılaştırılabilir",
  },
  {
    eyebrow: "02",
    title: "Dersi düzenli yürütme",
    body: "Ders bağlantısı, mesaj, materyal, kayıt ve ders notları aynı yerde durur.",
    metric: "1 panel",
    metricLabel: "tüm ders süreci",
  },
  {
    eyebrow: "03",
    title: "İlerlemeyi takip etme",
    body: "Plan, eksik konu, ödev çözümü ve veli bildirimi öğrencinin durumunu açık gösterir.",
    metric: "%72",
    metricLabel: "plan ilerlemesi örneği",
  },
] as const;

const commandTimeline = [
  "Öğrenci ihtiyacını seçer",
  "Uygun öğretmen veya kurs bulunur",
  "Ödeme cüzdanda güvenceye alınır",
  "Ders ve gelişim kaydı panelde görünür",
] as const;

const socialProofStats = [
  { value: "4 alan", label: "özel ders, soru çözüm, canlı ders, çalışma takibi" },
  { value: "10 dk", label: "acil sorular için hedef yanıt süresi" },
  { value: "3 rol", label: "öğrenci, öğretmen ve veli hesabı" },
] as const;

const leadershipStandards = [
  {
    title: "Güven",
    body: "Profil doğrulaması, yorumlar ve ödeme bilgisi karar vermeden önce görünür.",
    href: "/ogretmenler?verifiedOnly=1&sort=recommended",
  },
  {
    title: "Şeffaflık",
    body: "Teklif, ödeme, ders ve ders sonrası takip kayıt altında ilerler.",
    href: "/student/requests",
  },
  {
    title: "Ölçülebilir başarı",
    body: "Plan, eksik konu, ödev ve veli bildirimi gelişimi takip etmeyi kolaylaştırır.",
    href: "/student/calisma",
  },
] as const;

const trustQuotes = [
  {
    quote: "Öğretmen aramak, soru göndermek ve planı takip etmek aynı yerde olmalı.",
    source: "Öğrenci deneyimi",
  },
  {
    quote: "Doğrulama, yorum ve yanıt hızı görünür olunca öğretmen seçmek kolaylaşıyor.",
    source: "Veli güven katmanı",
  },
] as const;

const successStories = [
  {
    role: "Öğrenci",
    title: "LGS için öğretmen seçme",
    body: "Öğrenci matematik öğretmenlerini karşılaştırır, kısa liste yapar ve tek taleple teklif alır.",
    action: "Öğretmen sihirbazını aç",
    href: "/ogretmenler?verifiedOnly=1&sort=recommended&q=LGS%20Matematik",
  },
  {
    role: "Öğretmen",
    title: "Öğretmen profilini güçlendirme",
    body: "Öğretmen branş, ücret, video ve belge bilgilerini tamamlar. Öğrenciler daha net karar verir.",
    action: "Öğretmen başvurusu",
    href: "/kayit?role=teacher",
  },
  {
    role: "Veli",
    title: "Veli için haftalık takip",
    body: "Veli dersleri, soruları, öğretmen notlarını ve çalışma durumunu tek ekranda görür.",
    action: "Veli hesabı aç",
    href: "/kayit?role=guardian",
  },
] as const;

const howSteps = [
  {
    step: "1",
    title: "Kim olduğunuzu seçin",
    body: "Öğrenci, öğretmen veya veli hesabı seçin. Her hesap kendi panelini açar.",
  },
  {
    step: "2",
    title: "İşinizi seçin",
    body: "Öğretmen arayın, kursa katılın, soru gönderin veya çocuğunuzu takip edin.",
  },
  {
    step: "3",
    title: "Güvenli süreci izleyin",
    body: "Ödeme, iade hakkı, ders bağlantısı ve bildirimler panelde kayıtlı durur.",
  },
  {
    step: "4",
    title: "Sonucu görün",
    body: "Ders, soru çözüm, çalışma planı ve veli bildirimleri tek geçmişte toplanır.",
  },
] as const;

const plainRoleGuide = [
  {
    role: "Öğrenci",
    title: "Ders almak veya soru sormak istiyorum",
    points: [
      "Ücretsiz günlük 1 ilan ve 5 soru ile başla",
      "Yıllık abonelikle 5 ilan ve 10 soru hakkına çık",
      "Demo, ödeme, ders ve çalışma takibini tek panelde gör",
    ],
    href: "/kayit?role=student",
    cta: "Öğrenci olarak başla",
  },
  {
    role: "Öğretmen",
    title: "Öğrenci bulmak ve kazancımı görmek istiyorum",
    points: [
      "Abonelikle sınırsız teklif ver",
      "Profilini web siten gibi tam aç ve WhatsApp/telefon tercihini göster",
      "Kampanya, kurs, grup ders ve kazanç kayıtlarını yönet",
    ],
    href: "/kayit?role=teacher",
    cta: "Öğretmen olarak başla",
  },
  {
    role: "Veli",
    title: "Çocuğumun sürecini takip etmek istiyorum",
    points: [
      "Öğrenci hesabını eşleştir",
      "Ders, soru, çalışma ve abonelik hak kullanımını gör",
      "Ödeme ve destek kayıtlarını izle",
    ],
    href: "/kayit?role=guardian",
    cta: "Veli olarak başla",
  },
] as const;

const simplePaymentFlow = [
  "Öğrencinin ödediği tutar ders tamamlanana kadar bekletilir.",
  "İlk ders başlayınca ödeme tahsil edilir; öğretmen ödemesi bekler.",
  "İlk ders sonrası öğrenci iade talebi açabilir.",
  "İkinci derse girilirse iade hakkı kapanır. Net tutar öğretmene aktarılır.",
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
    <div className="bg-[radial-gradient(circle_at_12%_0%,rgba(88,170,169,0.12),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(235,163,107,0.12),transparent_30%),linear-gradient(180deg,#f7faf8_0%,#edf4f1_42%,#ffffff_100%)]">
      <HomeLaunchAnnouncement />
      <section className="relative overflow-hidden border-b border-brand-100 bg-[linear-gradient(135deg,#f7faf8_0%,#eef9f8_48%,#fff8f1_100%)] text-paper-950">
        <HeroArt />
        <div className="bo-ambient-orb pointer-events-none absolute left-[8%] top-16 h-40 w-40 rounded-full bg-brand-300/25 blur-3xl" aria-hidden />
        <div className="bo-ambient-orb pointer-events-none absolute right-[10%] top-28 h-44 w-44 rounded-full bg-warm-300/25 blur-3xl [animation-delay:1.4s]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-80 [background-image:linear-gradient(115deg,rgba(88,170,169,0.14),transparent_30%),linear-gradient(245deg,rgba(235,163,107,0.13),transparent_32%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.42),transparent_34%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.2] [background-image:linear-gradient(rgba(88,170,169,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(88,170,169,0.18)_1px,transparent_1px)] [background-size:36px_36px]"
          aria-hidden
        />
        <div className="relative z-0 mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_min(44%,min(440px,100%))] lg:items-center lg:gap-12">
            <div className="max-lg:order-2 lg:order-none">
              <div className="mb-5 inline-flex rounded-3xl border border-brand-100 bg-white/80 px-4 py-3 shadow-[0_18px_55px_rgba(88,170,169,0.16)] backdrop-blur">
                <BrandLockup asLink={false} className="[&_img]:h-14 sm:[&_img]:h-16" />
              </div>
              <p className="mb-3 inline-flex rounded-full border border-brand-200 bg-white/75 px-3 py-1 text-xs font-semibold text-brand-900 shadow-[0_10px_30px_rgba(88,170,169,0.14)] backdrop-blur">
                Dijital eğitim merkezi
              </p>
              <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-paper-950 sm:text-[2.7rem] sm:leading-[1.05]">
                Öğretmen bul, ders al, soru sor ve gelişimini takip et
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-paper-800">
                BenimÖğretmenim; öğrenci, öğretmen ve veli için ders sürecini tek yerde toplar. Kim ne yapacak,
                ödeme nasıl ilerleyecek ve dersler nereden takip edilecek açıkça görünür.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {heroSignals.map((signal) => (
                  <span
                    key={signal}
                    className="bo-card-lift rounded-full border border-brand-200 bg-white/75 px-3 py-1.5 text-xs font-semibold text-brand-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                  >
                    {signal}
                  </span>
                ))}
              </div>
              <form
                action="/ogretmenler"
                className="mt-6 rounded-3xl border border-brand-100 bg-white/82 p-3 shadow-[0_24px_80px_rgba(88,170,169,0.16)] backdrop-blur-xl"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/75">
                  Ders, sınav veya konu ara
                </div>
                <div className="mt-2 sm:flex sm:items-center sm:gap-2">
                  <label className="sr-only" htmlFor="home-teacher-search">
                    Ders, sınav veya konu ara
                  </label>
                  <input
                    id="home-teacher-search"
                    name="q"
                    type="search"
                    placeholder="Örn. LGS matematik, İngilizce konuşma, fizik"
                    className="w-full rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-sm text-paper-950 outline-none ring-brand-300 placeholder:text-paper-800/50 focus:ring-2"
                  />
                  <button
                    type="submit"
                    className="bo-glow-pulse mt-2 w-full rounded-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-warm-300 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_42px_rgba(88,170,169,0.22)] hover:brightness-105 sm:mt-0 sm:w-auto"
                  >
                    Ara
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickSubjects.map((label) => (
                    <Link
                      key={label}
                      href={`/ogretmenler?q=${encodeURIComponent(label)}`}
                      className="rounded-full border border-brand-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-paper-800 hover:border-brand-300 hover:bg-white"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </form>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/kayit?role=student"
                  className="rounded-2xl bg-brand-800 px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_45px_rgba(88,170,169,0.2)] hover:bg-brand-900"
                >
                  Öğrenci olarak başla
                </Link>
                <Link
                  href="/ogretmenler?verifiedOnly=1&sort=recommended"
                  className="rounded-2xl border border-brand-200 bg-white/75 px-4 py-2.5 text-sm font-semibold text-brand-900 backdrop-blur hover:bg-white"
                >
                  Öğretmenleri keşfet
                </Link>
                <Link
                  href="/kayit?role=teacher"
                  className="rounded-2xl border border-warm-200 bg-warm-50 px-4 py-2.5 text-sm font-semibold text-warm-900 hover:bg-warm-100"
                >
                  Öğretmen başvurusu
                </Link>
              </div>
              <HomeHeroPersonalized />
              <dl className="mt-10 grid grid-cols-2 gap-3 border-t border-brand-100 pt-10 sm:grid-cols-4 sm:gap-4">
                {homeHighlights.map((item) => (
                  <div key={item.title} className="bo-card-lift rounded-2xl border border-brand-100 bg-white/70 p-4 backdrop-blur">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-brand-100">
                      <HighlightIcon name={item.icon} />
                    </div>
                    <dt className="mt-2 text-sm font-semibold text-paper-950">{item.title}</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-paper-800/70">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <figure className="order-first mx-auto w-full max-w-md lg:order-none lg:mx-0 lg:max-w-none">
              <div className="bo-float-slow relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-3 shadow-[0_30px_110px_rgba(88,170,169,0.22)] backdrop-blur-xl">
                <div className="bo-shimmer-line absolute inset-x-6 top-3 z-10 h-px rounded-full bg-white/55" aria-hidden />
                <div className="relative h-full min-h-0 w-full overflow-hidden rounded-[1rem]">
                  <Image
                    src={HERO_PHOTO}
                    alt="Grup ders çalışması: öğrenciler birlikte not tutuyor"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 440px"
                    priority
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-brand-950/55 via-brand-950/12 to-warm-100/20" />
                  <div className="bo-float-delayed absolute left-4 top-4 rounded-2xl border border-white/55 bg-white/82 px-4 py-3 text-paper-950 shadow-xl backdrop-blur">
                    <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-brand-800/75">
                      Bugünkü özet
                    </div>
                    <div className="mt-1 text-xl font-semibold">3 işlem hazır</div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:grid-cols-3">
                    {avantPreviewCards.map((card) => (
                      <div key={card.label} className="bo-card-lift rounded-2xl border border-white/55 bg-white/80 p-3 text-paper-950 backdrop-blur-md">
                        <div className="text-[0.65rem] uppercase tracking-wide text-paper-800/60">{card.label}</div>
                        <div className="mt-1 text-lg font-semibold">{card.value}</div>
                        <div className="mt-1 text-[0.68rem] leading-tight text-paper-800/65">{card.hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute -right-7 top-1/3 h-24 w-24 rounded-full bg-brand-300/25 blur-2xl" aria-hidden />
                <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-warm-400/25 blur-2xl" aria-hidden />
              </div>
              <figcaption className="mt-2 text-center text-[0.65rem] leading-snug text-paper-800/55 lg:text-left">
                Fotoğraf:{" "}
                <a
                  href="https://unsplash.com/@brookecagle?utm_source=benimogretmenim&utm_medium=referral"
                  className="underline decoration-paper-300 underline-offset-2 hover:text-brand-800"
                  target="_blank"
                  rel="noreferrer"
                >
                  Brooke Cagle
                </a>{" "}
                /{" "}
                <a
                  href="https://unsplash.com/license?utm_source=benimogretmenim&utm_medium=referral"
                  className="underline decoration-paper-300 underline-offset-2 hover:text-brand-800"
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

      <section id="nasil" className="scroll-mt-24 border-b border-paper-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-[2rem] border border-brand-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef9f8_58%,#fff8f1_100%)] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-800/70">
                  Platformu 30 saniyede anlayın
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-950">
                  BenimÖğretmenim’de kim ne yapar?
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/75">
                  Öğrenci ders alır. Öğretmen ders verir. Veli süreci takip eder. Ödeme, iade hakkı, ders bağlantısı
                  ve bildirimler ilgili panelde açıkça görünür.
                </p>
              </div>
              <Link
                href="/kayit"
                className="w-fit rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900"
              >
                Rolümü seçip kayıt ol
              </Link>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {plainRoleGuide.map((item) => (
                <Link
                  key={item.role}
                  href={item.href}
                  className="group rounded-2xl border border-paper-200 bg-white/88 p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-[0_18px_50px_rgba(88,170,169,0.14)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-800/70">{item.role}</div>
                  <h3 className="mt-2 text-base font-semibold text-paper-950">{item.title}</h3>
                  <ul className="mt-4 space-y-2">
                    {item.points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm leading-relaxed text-paper-800/75">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex text-sm font-semibold text-brand-800 transition group-hover:translate-x-1">
                    {item.cta} →
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-brand-200 bg-white/82 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-paper-950">Ödeme ve iade en basit haliyle</h3>
                  <p className="mt-1 text-sm leading-relaxed text-paper-800/65">
                    Öğrenci ödeme tutarını platform cüzdanında güvenceye alır. Ders ilerledikçe ödeme ve iade durumu
                    panelde görünür.
                  </p>
                </div>
                <Link href="/guven" className="text-sm font-semibold text-brand-800 underline underline-offset-4">
                  Güven sayfasını incele
                </Link>
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-4">
                {simplePaymentFlow.map((step, index) => (
                  <li key={step} className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-900">
                      {index + 1}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-paper-800/75">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-paper-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-800/70">
                Neden güvenilir?
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-900">
                Güven, şeffaflık ve takip aynı yerde
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Burası sadece öğretmen listesi değildir. Öğretmen seçimi, ödeme, canlı ders ve gelişim takibi aynı
                yerde ilerler.
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
                Ders süreci
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Ders sürecinde hangi adımda olduğunuzu görün
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">
                Talep, öğretmen seçimi, ödeme, canlı ders ve takip bilgileri tek sırayla ilerler.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    Ders süreci
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">Dersin adımları</div>
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
                  Güven bilgileri
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-900">
                  Her şey kayıtlı ve takip edilebilir
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                  Öğretmen arama, ders, soru, ödeme ve veli bildirimi ayrı ayrı kaybolmaz. Her işlem ilgili panelde
                  sade bir kayıt olarak görünür.
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
                En sık kullanılan işlemlere buradan başlayın.
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
                Öğrenci, öğretmen ve veli farklı araçlar kullanır. Size uygun hesabı seçin.
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

      <section id="adimlar" className="scroll-mt-20 border-b border-paper-200 bg-paper-950 py-14 text-white sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Kullanım adımları</h2>
          <p className="mt-2 max-w-xl text-sm text-white/70">
            Önce hesabınızı seçin. Sonra ders, ödeme, soru ve bildirimleri kendi panelinizden takip edin.
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
                Özel ders, soru çözüm, canlı ders ve çalışma takibi ayrı ayrı kullanılabilir. Hepsi aynı hesapta
                toplanır.
              </p>
            </div>
            <Link href="/fiyatlar" className="text-sm font-semibold text-brand-800 underline underline-offset-4">
              Üyelikleri gör
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
                Öğrenciyseniz öğretmen arayın veya soru gönderin. Öğretmenseniz profil açın. Ödeme ve kazanç
                bilgileri ilgili panelde görünür.
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
                  Üyelikleri gör
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
