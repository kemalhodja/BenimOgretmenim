import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const yardimUrl = `${publicSiteUrl()}/yardim`;

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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(yardimFaqJsonLd()) }}
      />
      <p className="text-sm font-medium text-zinc-500">Site</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Yardım</h1>
      <p className="mt-2 text-sm text-zinc-600">Sık sorulan sorular.</p>
      <ul className="mt-10 space-y-8">
        {faq.map((item) => (
          <li key={item.q} className="border-b border-zinc-200 pb-8 last:border-0">
            <h2 className="text-base font-semibold text-zinc-900">{item.q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.a}</p>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/ogretmenler"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Öğretmen ara
        </Link>
        <Link
          href="/student/requests"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          Talep oluştur
        </Link>
        <Link
          href="/courses"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          Online kurslar
        </Link>
        <Link
          href="/student/dogrudan-dersler"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          Doğrudan dersler
        </Link>
        <Link
          href="/iletisim"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          İletişim
        </Link>
      </div>
    </div>
  );
}
