import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım koşulları",
  description:
    "BenimÖğretmenim platformunu kullanım kuralları — özet çerçeve metni.",
};

export default function KullanimKosullariPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Kullanım koşulları
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Aşağıdaki metin yasal nihai sözleşme yerine geçmez; yayına çıkmadan önce
        hukuk danışmanlığı ile güncellenmelidir.
      </p>
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-700">
        <h2 className="text-base font-semibold text-zinc-900">Hizmet</h2>
        <p>
          BenimÖğretmenim; öğrenci, veli ve öğretmenleri buluşturan dijital bir
          aracı platformdur. Dersin kendisi taraflar arasındadır; platform
          mümkün olduğunca iletişim ve ödeme kayıtlarını destekler.
        </p>
        <h2 className="text-base font-semibold text-zinc-900">Hesap ve içerik</h2>
        <p>
          Yanlış veya yanıltıcı profil, taciz, spam veya yasa dışı içerik
          yasaktır. Şüpheli kullanım durumunda hesap askıya alınabilir veya
          sonlandırılabilir.
        </p>
        <h2 className="text-base font-semibold text-zinc-900">Ödeme ve abonelik</h2>
        <p>
          Öğretmen abonelikleri ve öğrenci ödemeleri ilgili ürün kurallarına tabidir.
          İade ve anlaşmazlık süreçleri ayrıca tanımlanmalıdır.
        </p>
        <h2 className="text-base font-semibold text-zinc-900">Sorumluluk sınırı</h2>
        <p>
          Platform, tarafların birbirleriyle yaptığı sözlü veya yazılı anlaşmaların
          tarafı değildir; doğrudan zararlardan dolayı sorumluluk hukuken
          sınırlanabilir.
        </p>
      </section>
      <p className="mt-10 text-sm">
        <Link href="/" className="text-brand-800 underline">
          Ana sayfaya dön
        </Link>
      </p>
    </article>
  );
}
