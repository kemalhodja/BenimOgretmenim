import type { Metadata } from "next";
import Link from "next/link";
import { loginHrefWithReturn } from "../lib/authRedirect";
import { publicSiteUrl } from "../lib/siteUrl";

const yardimUrl = `${publicSiteUrl()}/yardim`;
const dogrudanDersLoginHref = loginHrefWithReturn("/student/dogrudan-dersler");

export const metadata: Metadata = {
  title: "Yardım ve sık sorulan sorular",
  description:
    "Öğretmen seçimi, teklifler, doğrudan ders ve cüzdan, kurslar, abonelik ve veli paneli hakkında kısa yanıtlar.",
  alternates: { canonical: yardimUrl },
  openGraph: {
    title: "Yardım · BenimÖğretmenim",
    description: "Öğretmen, talep, ders ve ödeme süreçleri hakkında SSS.",
    url: yardimUrl,
    locale: "tr_TR",
    type: "website",
  },
};

const faq = [
  {
    q: "Öğretmen nasıl seçilir?",
    a: "Branş ve şehir filtreleyin; profili okuyun. Talep açınca öğretmenler teklif gönderir.",
  },
  {
    q: "Teklif ve eşleşme",
    a: "Açık talebe birden fazla teklif gelir. Mesajlaşın, uygun olanı kabul edin.",
  },
  {
    q: "Doğrudan ders ve cüzdan",
    a: "Profilde anlaşma kurarsınız. Tutar cüzdandan bloke olur; ders bitince öğretmene geçer. Hareketler öğrenci panelinde.",
  },
  {
    q: "Online kurslar",
    a: "Kurs listesinden kayıt olun. Canlı oturum linkleri öğrenci kurs sayfasında; yönetim öğretmen panelinde.",
  },
  {
    q: "Öğretmen aboneliği",
    a: "Ücretsiz planda sınırlı teklif vardır. Abonelikle sınırsız teklif. Ödeme: PayTR (kart) veya doğrudan havale/EFT; havalede admin onayı sonrası abonelik açılır.",
  },
  {
    q: "Veli paneli",
    a: "Bağlandığınız öğrenci için özet ve bildirimler listelenir.",
  },
];

function yardimFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export default function YardimPage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(yardimFaqJsonLd()) }}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Yardım</h1>
        <p className="mt-2 text-sm text-paper-800/75">Sık sorulan sorular.</p>
        <ul className="mt-10 space-y-8">
          {faq.map((item) => (
            <li key={item.q} className="border-b border-paper-200 pb-8 last:border-0">
              <h2 className="text-base font-semibold text-paper-900">{item.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/80">{item.a}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/ogretmenler"
            className="inline-flex w-fit rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Öğretmen ara
          </Link>
          <p className="text-sm text-paper-800/70">
            <Link
              href={loginHrefWithReturn("/student/requests")}
              className="font-medium text-brand-800 underline-offset-4 hover:underline"
            >
              Talep
            </Link>
            {" · "}
            <Link href="/courses" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              Kurslar
            </Link>
            {" · "}
            <Link
              href={dogrudanDersLoginHref}
              className="font-medium text-brand-800 underline-offset-4 hover:underline"
            >
              Doğrudan ders
            </Link>
            {" · "}
            <Link href="/iletisim" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              İletişim
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
