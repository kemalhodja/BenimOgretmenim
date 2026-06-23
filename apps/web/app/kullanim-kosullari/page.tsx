import type { Metadata } from "next";
import Link from "next/link";
import { legalEntityName, supportEmail } from "../lib/legalEntity";
import { publicSiteUrl } from "../lib/siteUrl";

const kkUrl = `${publicSiteUrl()}/kullanim-kosullari`;

export const metadata: Metadata = {
  title: "Kullanım koşulları",
  description: "BenimÖğretmenim platform kullanım kuralları, ödeme modeli ve hesap politikaları.",
  alternates: { canonical: kkUrl },
  openGraph: {
    type: "website",
    title: "Kullanım koşulları · BenimÖğretmenim",
    description: "Platform kullanım kuralları.",
    url: kkUrl,
    locale: "tr_TR",
  },
};

export default function KullanimKosullariPage() {
  const entity = legalEntityName();
  const support = supportEmail();

  return (
    <article className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kullanım koşulları</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Son güncelleme: Haziran 2026. {entity} platformunu kullanarak bu koşulları kabul etmiş sayılırsınız.
        </p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-paper-800/85">
          <h2 className="text-base font-semibold text-paper-900">Hizmet</h2>
          <p>
            {entity}; öğrenci, veli ve öğretmenleri özel ders, soru çözüm, canlı sınıf, çalışma takibi
            ve bildirimlerde buluşturan dijital eğitim platformudur. Platform, ders ve ödeme adımlarını
            kayıt altına alır; finans, sağlık veya bankacılık hizmeti sunmaz.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Ödeme modeli</h2>
          <p>
            Öğrenci ders ve abonelik bedelini platforma öder. Öğretmen platforma komisyon ödemez;
            tamamlanan derslere ilişkin hak ediş platform politikasına göre ödenir. Kart ödemeleri ödeme
            sağlayıcısı üzerinden; havale/EFT ödemeleri onay sürecine tabidir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Hesap ve içerik</h2>
          <p>
            Kullanıcılar doğru bilgi vermek, hesap güvenliğini korumak ve başkalarının haklarını ihlal
            etmeyen içerik paylaşmakla yükümlüdür. Yanıltıcı profil, sahte belge, taciz, spam veya
            platform dışına yönlendiren kötüye kullanım tespit edilirse hesap askıya alınabilir veya
            kapatılabilir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Öğretmen doğrulama</h2>
          <p>
            Öğretmen profilleri belge, branş, deneyim ve davranış kalitesine göre değerlendirilebilir.
            Platform görünürlüğü kısıtlayabilir, ek belge isteyebilir veya inceleme başlatabilir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">İptal, iade ve itiraz</h2>
          <p>
            Ders, paket ve ödeme sorunları platform kayıtları üzerinden incelenir. İade koşulları{" "}
            <Link href="/iade" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              iade politikası
            </Link>{" "}
            sayfasında açıklanır. Uyuşmazlıklar için{" "}
            <Link href="/itiraz" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              itiraz
            </Link>{" "}
            akışı kullanılabilir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Kişisel veriler</h2>
          <p>
            Veri işleme{" "}
            <Link href="/gizlilik" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              gizlilik politikası
            </Link>{" "}
            ve KVKK metnine tabidir. Hesap silme talebi{" "}
            <Link href="/ayarlar/hesap" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              hesap ayarları
            </Link>{" "}
            üzerinden iletilebilir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Sorumluluk sınırı</h2>
          <p>
            Platform kayıtlı süreçleri ve teknik altyapıyı sunar. Kullanıcıların platform dışında yaptığı
            anlaşma ve ödemelerden platform sorumlu tutulamaz. Güvenli deneyim için iletişim ve ödemenin
            platform içinde yapılması önerilir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">İletişim</h2>
          <p>
            Sorularınız için{" "}
            <a href={`mailto:${support}`} className="font-medium text-brand-800 underline-offset-4 hover:underline">
              {support}
            </a>{" "}
            veya{" "}
            <Link href="/iletisim" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              iletişim
            </Link>{" "}
            sayfasını kullanın.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/gizlilik" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Gizlilik
          </Link>
          <Link href="/iade" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            İade
          </Link>
          <Link href="/" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Ana sayfa
          </Link>
        </div>
      </div>
    </article>
  );
}
