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
  "Özel dersde öğretmen bulun, talep açın, teklifleri karşılaştırın.";

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

const quickSubjects = ["Matematik", "İngilizce", "LGS", "Fizik"] as const;

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
      <section className="relative overflow-hidden border-b border-paper-200 bg-white">
        <HeroArt />
        <div className="relative z-0 mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_min(44%,min(440px,100%))] lg:items-center lg:gap-12">
            <div className="max-lg:order-2 lg:order-none">
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-paper-900 sm:text-[2.5rem] sm:leading-[1.12]">
            Öğretmen bulun, talep açın, teklifleri karşılaştırın
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-paper-800/85">
            Bir talep yeter: uygun öğretmenler teklif gönderir; siz karşılaştırıp güvenle ödersiniz.
          </p>
          <HomeHeroPersonalized />
          <div className="mt-8">
            <p className="text-xs font-medium text-paper-800/50">Örnek aramalar</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickSubjects.map((label) => (
                <Link
                  key={label}
                  href={`/ogretmenler?q=${encodeURIComponent(label)}`}
                  className="rounded-full border border-paper-200 bg-white px-3 py-1.5 text-xs font-medium text-paper-800 hover:border-brand-300 hover:bg-brand-50/50"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-3 border-t border-paper-200 pt-10 sm:grid-cols-4 sm:gap-4">
            {homeHighlights.map((item) => (
              <div key={item.title} className="rounded-xl border border-paper-200 bg-paper-50/80 p-4">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-800 ring-1 ring-paper-200">
                  <HighlightIcon name={item.icon} />
                </div>
                <dt className="mt-2 text-sm font-semibold text-paper-900">{item.title}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-paper-800/75">{item.body}</dd>
              </div>
            ))}
          </dl>
            </div>

            <figure className="order-first mx-auto w-full max-w-md lg:order-none lg:mx-0 lg:max-w-none">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-paper-200 bg-paper-100 shadow-sm">
                <div className="relative h-full min-h-0 w-full overflow-hidden rounded-[1rem]">
                  <Image
                    src={HERO_PHOTO}
                    alt="Grup ders çalışması: öğrenciler birlikte not tutuyor"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 440px"
                    priority
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper-950/20 via-transparent to-transparent" />
                </div>
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

      <section id="nasil" className="scroll-mt-20 border-b border-paper-200 bg-paper-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-paper-900 sm:text-3xl">Nasıl çalışır?</h2>
          <p className="mt-2 max-w-xl text-sm text-paper-800/80">Üç kısa adım.</p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { step: "1", title: "Talep", body: "Branşınızı ve zamanı yazın." },
              { step: "2", title: "Teklif", body: "Gelen teklifleri okuyup yazışın." },
              { step: "3", title: "Başlayın", body: "Uygun teklifi seçip ödemeyi tamamlayın." },
            ].map((item) => (
              <li key={item.step} className="rounded-xl border border-paper-200 bg-white p-5">
                <span className="text-sm font-bold text-brand-700">{item.step}</span>
                <h3 className="mt-2 text-base font-semibold text-paper-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-paper-800/80">{item.body}</p>
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

      <section className="border-t border-paper-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm text-paper-800/85">
            Ödeme ve abonelik bilgileriniz panele giriş yaptığınızda görünür.
          </p>
        </div>
      </section>
    </div>
  );
}
