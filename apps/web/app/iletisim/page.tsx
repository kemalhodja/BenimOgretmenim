import type { Metadata } from "next";
import Link from "next/link";
import { kvkkEmail, legalEntityAddress, legalEntityName, supportEmail } from "../lib/legalEntity";
import { publicSiteUrl } from "../lib/siteUrl";

const iletisimUrl = `${publicSiteUrl()}/iletisim`;

export const metadata: Metadata = {
  title: "İletişim",
  description: "BenimÖğretmenim destek, ödeme, iade ve iş birliği iletişim bilgileri.",
  alternates: { canonical: iletisimUrl },
  openGraph: {
    type: "website",
    title: "İletişim · BenimÖğretmenim",
    description: "Destek, ödeme, iade ve iş birliği kanalları.",
    url: iletisimUrl,
    locale: "tr_TR",
  },
};

function iletisimJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "İletişim",
    url: iletisimUrl,
  };
}

const contactTopics = [
  {
    title: "Öğrenci ve veli desteği",
    body: "Öğretmen seçimi, ders talebi, kurs kaydı, cüzdan ve veli bağlantısı için hesap e-postanızı yazın.",
  },
  {
    title: "Öğretmen desteği",
    body: "Profil, abonelik, kampanya, teklif ve para çekme konularında öğretmen hesabınızla ilişkili e-postayı ekleyin.",
  },
  {
    title: "Ödeme ve iade",
    body: "İşlem tarihi, tutar, ödeme yöntemi ve varsa ders/kurs adını yazmanız incelemeyi hızlandırır.",
  },
] as const;

export default function IletisimPage() {
  const entity = legalEntityName();
  const address = legalEntityAddress();
  const support = supportEmail();
  const kvkk = kvkkEmail();

  return (
    <article className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(iletisimJsonLd()) }}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">İletişim</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-paper-800/75">
          Destek, ödeme, iade, öğretmen başvurusu ve iş birliği konularında bize ulaşabilirsiniz.
          Talebinizde hesap e-postanızı ve ilgili ders/kurs bilgisini yazmanız süreci hızlandırır.
        </p>
        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {contactTopics.map((topic) => (
            <div key={topic.title} className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-paper-900">{topic.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-paper-800/70">{topic.body}</p>
            </div>
          ))}
        </section>
        <div className="mt-8 rounded-xl border border-paper-200 bg-white p-6">
          <dl className="space-y-5 text-sm">
            <div>
              <dt className="font-medium text-paper-900">Veri sorumlusu</dt>
              <dd className="mt-1 text-paper-800/75">
                {entity} — {address}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-paper-900">E-posta</dt>
              <dd className="mt-1 text-paper-800/75">
                <a href={`mailto:${support}`} className="font-mono text-brand-800 hover:underline">
                  {support}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-paper-900">KVKK başvuruları</dt>
              <dd className="mt-1 text-paper-800/75">
                <a href={`mailto:${kvkk}`} className="font-mono text-brand-800 hover:underline">
                  {kvkk}
                </a>
                {" · "}
                <Link href="/ayarlar/hesap" className="text-brand-800 hover:underline">
                  Hesap silme talebi
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-paper-900">Ödeme ve güven talepleri</dt>
              <dd className="mt-1 text-paper-800/75">
                Ödeme, iade, cüzdan, öğretmen doğrulama ve veli bağlantısı konularında işlem tarihi,
                hesap e-postası ve varsa ders/ödeme bilgisini ekleyin.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-paper-900">Önce hızlı yanıt arayın</dt>
              <dd className="mt-1 text-paper-800/75">
                En sık sorulan öğretmen seçimi, kurs kaydı, ödeme güvencesi ve iade sorularını yardım sayfasında
                kısa yanıtlarla topladık.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-paper-900">Çalışma saatleri</dt>
              <dd className="mt-1 text-paper-800/75">Hafta içi 10:00–18:00 (GMT+3)</dd>
            </div>
          </dl>
        </div>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/yardim" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Yardım sayfası
          </Link>
          <Link href="/guven" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Güven merkezi
          </Link>
          <Link href="/" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Ana sayfa
          </Link>
        </div>
      </div>
    </article>
  );
}
