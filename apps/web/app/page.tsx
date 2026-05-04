import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HomeHeroPersonalized } from "./components/HomeHeroPersonalized";
import { HeroArt } from "./components/HeroArt";
import { StudentAudienceCard, TeacherAudienceCard } from "./components/marketing/AudienceCards";
import { RoleOrderedAudience } from "./components/RoleOrderedAudience";
import { publicSiteUrl } from "./lib/siteUrl";

/** Ana sayfa hero — Unsplash (ücretsiz kullanım; altta atıf) */
const HERO_PHOTO =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=960&q=80";

const HOME_OG_DESCRIPTION =
  "Öğretmen arayın, talep açın, teklifleri karşılaştırın. Kurslar, doğrudan ders, cüzdan ve veli özeti.";

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

const quickSubjects = [
  "LGS",
  "İlkokul",
  "Ortaokul",
  "Matematik",
  "İngilizce",
] as const;

const homeHighlights: {
  title: string;
  body: string;
  icon: "scale" | "chat" | "users" | "card";
}[] = [
  { title: "Teklifler", body: "Birden fazla öğretmenden teklif", icon: "scale" },
  { title: "Mesaj", body: "Talep üzerinden yazışma", icon: "chat" },
  { title: "Veli", body: "Ders özeti ve bildirim", icon: "users" },
  { title: "Ödeme", body: "Cüzdan, PayTR veya doğrudan havale", icon: "card" },
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
      <section className="relative overflow-hidden border-b border-paper-200/60 bg-gradient-to-b from-brand-50/30 via-paper-50 to-white">
        <HeroArt />
        <div className="relative z-0 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_min(44%,min(440px,100%))] lg:items-center lg:gap-14">
            <div className="max-lg:order-2 lg:order-none">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-900 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
            Özel ders
          </p>
          <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-paper-900 sm:text-[2.75rem] sm:leading-[1.1]">
            Öğretmen bul, talep aç, teklifleri karşılaştır.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-paper-800/90">
            Arama, talep, teklif, mesaj ve ödeme tek yerde.
          </p>
          <HomeHeroPersonalized />
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wide text-paper-800/55">
              Popüler branşlar
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickSubjects.map((label) => (
                <Link
                  key={label}
                  href={`/ogretmenler?q=${encodeURIComponent(label)}`}
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
              Görünür teklif süreci
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/90" aria-hidden />
              Veli özeti
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
                className="rounded-2xl border border-paper-200/70 bg-white p-4 shadow-md shadow-paper-900/5 ring-1 ring-paper-100/80"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
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
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-paper-200 shadow-[0_24px_56px_-14px_rgba(22,34,51,0.28)] ring-1 ring-paper-300/50">
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
          <p className="mt-2 max-w-xl text-sm text-paper-800/80">
            Üç adım. Yönetim panelden.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Talep",
                body: "Branş ve zamanı yaz; talep öğretmenlere açılır.",
              },
              {
                step: "2",
                title: "Teklif",
                body: "Gelen teklifleri oku, mesajla, karşılaştır.",
              },
              {
                step: "3",
                title: "Başla",
                body: "Uygun teklifi kabul et; ödeme panelden.",
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
        <RoleOrderedAudience
          studentSlot={<StudentAudienceCard />}
          teacherSlot={<TeacherAudienceCard />}
        />
      </section>

      <section className="border-t border-paper-200/60 bg-paper-100/40 py-12">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm font-semibold text-paper-900">Kayıtlar</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-paper-800/85">
            Ödemeler ve abonelik durumu panelden izlenir.
          </p>
        </div>
      </section>
    </div>
  );
}
