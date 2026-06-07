import type { Metadata } from "next";
import Link from "next/link";
import { loginHrefWithReturn } from "../lib/authRedirect";
import { publicSiteUrl } from "../lib/siteUrl";

const yardimUrl = `${publicSiteUrl()}/yardim`;
const dogrudanDersLoginHref = loginHrefWithReturn("/student/dogrudan-dersler");

export const metadata: Metadata = {
  title: "Yardım ve sık sorulan sorular",
  description:
    "Öğretmen seçimi, teklifler, ödeme güvencesi, iade, kurslar, abonelik ve veli paneli hakkında kısa yanıtlar.",
  alternates: { canonical: yardimUrl },
  openGraph: {
    title: "Yardım · BenimÖğretmenim",
    description: "Öğretmen, talep, ders, ödeme ve iade hakkında sık sorulan sorular.",
    url: yardimUrl,
    locale: "tr_TR",
    type: "website",
  },
};

const faq = [
  {
    q: "Öğretmen nasıl seçilir?",
    a: "Branş ve şehir seçin, profilleri karşılaştırın. Emin değilseniz demo talebi açıp öğretmenin yöntemini önce görün.",
  },
  {
    q: "Teklif ve eşleşme",
    a: "Talebinize birden fazla teklif gelebilir. Ücret, ders süresi, öğretmen profili ve mesajları karşılaştırıp uygun olanı kabul edin.",
  },
  {
    q: "Doğrudan ders ve cüzdan",
    a: "Öğretmen profilinden ders başlatabilirsiniz. Tutar önce cüzdanda güvenceye alınır; ders tamamlanınca öğretmene aktarılır. Tüm hareketler öğrenci panelinde görünür.",
  },
  {
    q: "Kurs ödemesi ve iade hakkı",
    a: "Kursa kayıtta ücret cüzdanda güvenceye alınır. İlk ders sonrası iade talebi oluşturabilirsiniz. İkinci derse girerseniz iade hakkı kapanır.",
  },
  {
    q: "Online kurslar",
    a: "Kurs listesinden programı ve ücreti inceleyin. Kayıt sonrası canlı ders linkleri öğrenci kurs sayfasında görünür.",
  },
  {
    q: "Öğretmen aboneliği",
    a: "Ücretsiz planda teklif hakkı sınırlıdır. Abonelikle daha fazla görünürlük ve sınırsız teklif hakkı açılır. Kart ödemesi PayTR ile, havale/EFT ise admin onayıyla ilerler.",
  },
  {
    q: "Veli paneli",
    a: "Veli hesabı bağlandığı öğrencinin ders notlarını, ödev durumunu, çalışma planını ve önemli bildirimleri takip eder.",
  },
];

const quickSteps = [
  { title: "Öğrenci", body: "Öğretmen ara, talep aç, teklifleri karşılaştır ve derslerini panelden takip et." },
  { title: "Öğretmen", body: "Profilini tamamla, teklif gönder, kampanya oluştur ve kazançlarını cüzdandan izle." },
  { title: "Veli", body: "Öğrencini bağla; ders, ödev ve ilerleme bildirimlerini tek yerden gör." },
] as const;

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
        <p className="mt-2 text-sm text-paper-800/75">
          En çok merak edilen adımları kısa ve net yanıtlarla topladık.
        </p>
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {quickSteps.map((step) => (
            <div key={step.title} className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-paper-900">{step.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-paper-800/70">{step.body}</p>
            </div>
          ))}
        </section>
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
