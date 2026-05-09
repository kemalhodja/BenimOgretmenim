import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const iletisimUrl = `${publicSiteUrl()}/iletisim`;

export const metadata: Metadata = {
  title: "İletişim",
  description: "BenimÖğretmenim ile iletişim bilgileri.",
  alternates: { canonical: iletisimUrl },
  openGraph: {
    type: "website",
    title: "İletişim · BenimÖğretmenim",
    description: "Destek ve iş birliği kanalları.",
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

export default function IletisimPage() {
  return (
    <article className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(iletisimJsonLd()) }}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">İletişim</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Destek ve iş birliği için e-posta veya yardım sayfasını kullanın.
        </p>
        <div className="mt-8 rounded-xl border border-paper-200 bg-white p-6">
          <dl className="space-y-5 text-sm">
            <div>
              <dt className="font-medium text-paper-900">E-posta</dt>
              <dd className="mt-1 text-paper-800/75">
                <span className="font-mono text-paper-800/65">destek@benimogretmenim.com</span>{" "}
                <span className="text-xs text-paper-800/50">(örnek)</span>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-paper-900">Çalışma saatleri</dt>
              <dd className="mt-1 text-paper-800/75">Hafta içi 10:00–18:00 (GMT+3)</dd>
            </div>
          </dl>
        </div>
        <p className="mt-8 text-sm text-paper-800/75">
          <Link href="/yardim" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Yardım
          </Link>
          {" · "}
          <Link href="/" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Ana sayfa
          </Link>
        </p>
      </div>
    </article>
  );
}
