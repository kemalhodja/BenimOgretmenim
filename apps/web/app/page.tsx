import Image from "next/image";
import Link from "next/link";
import { RegisterNavLink } from "./components/AuthNavLinks";
import { HeroArt } from "./components/HeroArt";

/** Ana sayfa hero — Unsplash (ücretsiz kullanım; altta atıf) */
const HERO_PHOTO =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=960&q=80";

const quickSubjects = ["Matematik", "İngilizce", "Fizik", "YKS", "Kodlama"] as const;

const homeHighlights: {
  title: string;
  body: string;
  icon: "scale" | "chat" | "users" | "card";
}[] = [
  {
    title: "Teklif karşılaştırma",
    body: "Birden fazla öğretmen teklifi",
    icon: "scale",
  },
  {
    title: "Mesajlaşma",
    body: "Talep üzerinden güvenli yazışma",
    icon: "chat",
  },
  {
    title: "Veli görünürlüğü",
    body: "Ders sonu özet ve bildirimler",
    icon: "users",
  },
  {
    title: "Ödeme",
    body: "Cüzdan, kart (PayTR) veya havale / EFT",
    icon: "card",
  },
];

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
    <div className="bg-paper-50">
      <section className="relative overflow-hidden border-b border-paper-200/60 bg-gradient-to-b from-warm-50/40 via-paper-50 to-white">
        <HeroArt />
        <div className="relative z-0 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_min(44%,min(440px,100%))] lg:items-center lg:gap-14">
            <div className="max-lg:order-2 lg:order-none">
          <p className="inline-flex items-center gap-2 rounded-full border border-paper-200/80 bg-white/85 px-3 py-1 text-sm font-medium text-brand-800 shadow-sm ring-1 ring-warm-100/60 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-warm-500" />
            Özel ders · Online & yüz yüze
          </p>
          <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-paper-900 sm:text-5xl">
            Aradığın öğretmeni bul, talebini paylaş, teklifleri karşılaştır.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-800/85">
            Branş ve şehre göre arama, ders talebi, teklifler, mesajlaşma ve ödeme
            seçenekleri tek çatı altında; süreçler sade ve şeffaf.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/ogretmenler"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-brand-600 via-brand-700 to-brand-900 px-6 py-3 text-sm font-semibold text-white shadow-md ring-1 ring-brand-800/25 transition hover:from-brand-700 hover:via-brand-800 hover:to-brand-950"
            >
              Öğretmen ara
            </Link>
            <Link
              href="/student/requests"
              className="inline-flex items-center justify-center rounded-xl border border-paper-200 bg-white/90 px-6 py-3 text-sm font-semibold text-paper-900 shadow-sm ring-1 ring-paper-200/70 backdrop-blur-sm transition hover:border-warm-200/90 hover:bg-white"
            >
              Ücretsiz ders talebi oluştur
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center justify-center rounded-xl border border-paper-200 bg-white/90 px-6 py-3 text-sm font-semibold text-paper-900 shadow-sm ring-1 ring-paper-200/70 backdrop-blur-sm transition hover:border-warm-200/90 hover:bg-white"
            >
              Online kurslar
            </Link>
            <RegisterNavLink className="inline-flex items-center justify-center rounded-xl border border-transparent px-6 py-3 text-sm font-semibold text-brand-800 underline-offset-4 hover:underline">
              Öğretmen olarak kayıt ol →
            </RegisterNavLink>
          </div>
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wide text-paper-800/55">
              Hızlı başlangıç
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickSubjects.map((label) => (
                <Link
                  key={label}
                  href="/ogretmenler"
                  className="rounded-full border border-paper-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-paper-800 shadow-sm ring-1 ring-paper-100/80 transition hover:border-brand-200 hover:text-brand-900"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-paper-200/60 pt-8 text-xs font-medium text-paper-800/80">
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/90" aria-hidden />
              Şeffaf teklif süreci
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/90" aria-hidden />
              Veli gelişim özeti
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/90" aria-hidden />
              Öğretmen aboneliği
            </li>
          </ul>
          <dl className="mt-10 grid grid-cols-2 gap-4 border-t border-brand-100/80 pt-10 sm:grid-cols-4 sm:gap-5">
            {homeHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-paper-200/60 bg-white/70 p-4 shadow-sm ring-1 ring-paper-100/90 backdrop-blur-sm"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-warm-50/80 text-brand-800">
                  <HighlightIcon name={item.icon} />
                </div>
                <dt className="mt-3 text-sm font-semibold text-paper-900">
                  {item.title}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed text-paper-800/80">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
            </div>

            <figure className="order-first mx-auto w-full max-w-md lg:order-none lg:mx-0 lg:max-w-none">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-paper-200 shadow-[0_20px_50px_-12px_rgba(22,34,51,0.25)] ring-1 ring-paper-300/60">
                <Image
                  src={HERO_PHOTO}
                  alt="Grup ders çalışması: öğrenciler birlikte not tutuyor"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 440px"
                  priority
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper-950/25 via-transparent to-transparent" />
              </div>
              <figcaption className="mt-2 text-center text-[0.65rem] leading-snug text-paper-800/55 lg:text-left">
                Fotoğraf:{" "}
                <a
                  href="https://unsplash.com/@brookecagle?utm_source=benimogretmenim&utm_medium=referral"
                  className="underline decoration-paper-400/80 underline-offset-2 hover:text-brand-800"
                  target="_blank"
                  rel="noreferrer"
                >
                  Brooke Cagle
                </a>{" "}
                /{" "}
                <a
                  href="https://unsplash.com/license?utm_source=benimogretmenim&utm_medium=referral"
                  className="underline decoration-paper-400/80 underline-offset-2 hover:text-brand-800"
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

      <section id="nasil" className="scroll-mt-20 border-b border-paper-200/50 bg-paper-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-paper-900 sm:text-3xl">
            Nasıl çalışır?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-paper-800/80">
            Üç adımda eşleşme; detayları istediğin zaman panelden yönetirsin.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Talep oluştur",
                body: "Branşını, müsait olduğun zamanları ve notunu yaz. Talebin öğretmenlere görünür; teklif almaya açılır.",
              },
              {
                step: "2",
                title: "Teklifleri incele",
                body: "Öğretmenler mesaj ve ücret önerisi gönderir; karşılaştır, soru sor, sohbet et.",
              },
              {
                step: "3",
                title: "Eşleş ve başla",
                body: "Uygun teklifi kabul et. Öğretmen aboneliği ve ödemeler panelden yürür.",
              },
            ].map((item) => (
              <li
                key={item.step}
                className="relative rounded-2xl border border-paper-200/80 bg-gradient-to-b from-white to-paper-100/30 p-6 shadow-sm ring-1 ring-paper-100/90"
              >
                <span className="absolute -top-3 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-warm-500 text-sm font-bold text-white shadow-md ring-2 ring-paper-50">
                  {item.step}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-paper-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-800/80">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6">
          <div className="rounded-2xl border border-paper-200/90 bg-white/80 p-8 shadow-sm ring-1 ring-paper-100/80">
            <h2 className="text-xl font-semibold text-paper-900">Öğrenci & veli</h2>
            <p className="mt-3 text-sm leading-relaxed text-paper-800/80">
              Öğretmen profillerini incele, yorumları oku, talep aç ve teklifleri
              tek yerden yönet. Veli hesabı ile çocuğunun gelişim özetlerini ve
              bildirimleri takip et.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/student/requests"
                className="rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-950"
              >
                Talep başlat
              </Link>
              <Link
                href="/guardian"
                className="rounded-xl border border-paper-200 bg-white px-4 py-2.5 text-sm font-medium text-paper-800"
              >
                Veli paneli
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <Link href="/courses" className="font-medium text-brand-800 underline">
                Kurs keşfet
              </Link>
              <Link href="/student/panel" className="font-medium text-paper-800/90 underline">
                Abonelik & cüzdan
              </Link>
              <Link href="/student/dogrudan-dersler" className="font-medium text-paper-800/90 underline">
                Doğrudan ders anlaşmaları
              </Link>
              <Link href="/student/kurslar" className="font-medium text-paper-800/90 underline">
                Kayıtlı kurslarım
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-warm-200/80 bg-gradient-to-b from-warm-50/90 to-amber-50/30 p-8 shadow-sm ring-1 ring-warm-100/50">
            <h2 className="text-xl font-semibold text-paper-900">Öğretmen</h2>
            <p className="mt-3 text-sm leading-relaxed text-paper-800/80">
              Açık taleplere teklif ver, abonelikle sınırsız teklif aç, PayTR veya
              havale ile öde. Profilini ve branşlarını tamamla; görünürlüğün artsın.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/teacher"
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white"
              >
                Panele git
              </Link>
              <Link
                href="/teacher/requests"
                className="rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-medium text-brand-900"
              >
                Talep gelen kutusu
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <Link href="/teacher/kurslar" className="font-medium text-brand-900 underline">
                Online kurslar
              </Link>
              <Link href="/teacher/cuzdan" className="font-medium text-brand-900 underline">
                Cüzdan
              </Link>
              <Link href="/teacher/dogrudan-dersler" className="font-medium text-brand-900 underline">
                Doğrudan ders anlaşmaları
              </Link>
              <Link href="/teacher/odev-havuzu" className="font-medium text-brand-900 underline">
                Ödev havuzu
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-paper-200/60 bg-paper-100/30 py-12">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm font-medium text-paper-800/70">Güven ve şeffaflık</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-paper-800/80">
            Ödeme kayıtları, havale onayı ve PayTR callback ile abonelik
            durumu izlenebilir. Üretim ortamında CORS ve admin gizli anahtarı
            ile uçlar sıkılaştırılır.
          </p>
        </div>
      </section>
    </div>
  );
}
