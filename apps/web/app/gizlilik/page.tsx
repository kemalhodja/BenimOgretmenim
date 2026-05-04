import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const gizlilikUrl = `${publicSiteUrl()}/gizlilik`;

export const metadata: Metadata = {
  title: "Gizlilik ve KVKK",
  description:
    "Kişisel verilerin işlenmesi, saklanması ve haklarınız hakkında özet bilgilendirme.",
  alternates: { canonical: gizlilikUrl },
  openGraph: {
    type: "website",
    title: "Gizlilik ve KVKK · BenimÖğretmenim",
    description: "Kişisel veriler ve haklarınız hakkında özet.",
    url: gizlilikUrl,
    locale: "tr_TR",
  },
};

export default function GizlilikPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-zinc-500">Site</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
        Gizlilik ve kişisel veriler
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Bu metin hukuki nihai sürüm değildir; ürün geliştikçe avukat onaylı KVKK
        metni ve aydınlatma metinleri burada yayınlanmalıdır.
      </p>
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-zinc-700">
        <h2 className="text-base font-semibold text-zinc-900">Toplanan veriler</h2>
        <p>
          Hesap oluştururken e-posta, görünen ad ve rol bilgisi; öğretmen ve
          öğrenci profillerinde tercih ettiğiniz branş, şehir, müsaitlik ve mesaj
          içerikleri işlenebilir. Ödeme işlemlerinde ödeme sağlayıcı (ör. PayTR)
          kendi politikalarına göre ek veri işleyebilir.
        </p>
        <h2 className="text-base font-semibold text-zinc-900">Amaç</h2>
        <p>
          Veriler; hesabınızı sunmak, talep ve teklif eşleştirmesi yapmak, veli
          bildirimleri iletmek ve yasal yükümlülükleri yerine getirmek için
          kullanılır.
        </p>
        <h2 className="text-base font-semibold text-zinc-900">Haklarınız</h2>
        <p>
          KVKK kapsamında erişim, düzeltme, silme, itiraz ve şikâyet haklarınız
          vardır. Talepleriniz için iletişim adresinizi ürün ayarlarına
          eklemeniz önerilir.
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
