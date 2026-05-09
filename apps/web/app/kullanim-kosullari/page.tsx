import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const kkUrl = `${publicSiteUrl()}/kullanim-kosullari`;

export const metadata: Metadata = {
  title: "Kullanım koşulları",
  description:
    "BenimÖğretmenim platformunu kullanım kuralları — özet çerçeve metni.",
  alternates: { canonical: kkUrl },
  openGraph: {
    type: "website",
    title: "Kullanım koşulları · BenimÖğretmenim",
    description: "Platform kullanım kuralları özeti.",
    url: kkUrl,
    locale: "tr_TR",
  },
};

export default function KullanimKosullariPage() {
  return (
    <article className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kullanım koşulları</h1>
      <p className="mt-2 text-sm text-paper-800/75">
        Özet çerçeve; yürürlük öncesi hukuk danışmanlığı ile tam metin hazırlanmalıdır.
      </p>
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-paper-800/85">
        <h2 className="text-base font-semibold text-paper-900">Hizmet</h2>
        <p>
          BenimÖğretmenim; öğrenci, veli ve öğretmenleri buluşturan dijital bir
          aracı platformdur. Dersin kendisi taraflar arasındadır; platform
          mümkün olduğunca iletişim ve ödeme kayıtlarını destekler.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Hesap ve içerik</h2>
        <p>
          Yanlış veya yanıltıcı profil, taciz, spam veya yasa dışı içerik
          yasaktır. Şüpheli kullanım durumunda hesap askıya alınabilir veya
          sonlandırılabilir.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Ödeme ve abonelik</h2>
        <p>
          Öğretmen abonelikleri ve öğrenci ödemeleri ilgili ürün kurallarına tabidir.
          İade ve anlaşmazlık süreçleri ayrıca tanımlanmalıdır.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Sorumluluk sınırı</h2>
        <p>
          Platform, tarafların birbirleriyle yaptığı sözlü veya yazılı anlaşmaların
          tarafı değildir; doğrudan zararlardan dolayı sorumluluk hukuken
          sınırlanabilir.
        </p>
      </section>
      <p className="mt-10 text-sm">
        <Link href="/" className="font-medium text-brand-800 underline-offset-4 hover:underline">
          Ana sayfa
        </Link>
      </p>
      </div>
    </article>
  );
}
