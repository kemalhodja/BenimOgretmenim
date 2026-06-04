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
        Bu çerçeve; öğrenciler, veliler, öğretmenler ve yöneticiler için platform kullanım kurallarını,
        ödeme süreçlerini ve güvenlik beklentilerini açıklar.
      </p>
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-paper-800/85">
        <h2 className="text-base font-semibold text-paper-900">Hizmet</h2>
        <p>
          BenimÖğretmenim; öğrenci, veli ve öğretmenleri özel ders, soru çözüm, canlı sınıf, çalışma
          takibi, cüzdan ve bildirim akışlarında buluşturan dijital eğitim platformudur. Platform,
          süreçleri kayıt altına alır ve güvenli ödeme/operasyon altyapısını sağlar.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Hesap ve içerik</h2>
        <p>
          Kullanıcılar doğru bilgi vermek, hesap güvenliğini korumak ve başkalarının haklarını ihlal
          etmeyen içerik paylaşmakla yükümlüdür. Yanıltıcı profil, sahte belge, taciz, spam, yasa dışı
          içerik veya platform dışına yönlendiren kötüye kullanım tespit edilirse hesap kısıtlanabilir.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Öğretmen doğrulama ve kalite</h2>
        <p>
          Öğretmen profilleri doğrulama, belge, branş, şehir, deneyim, ders geçmişi, puan ve yanıt
          davranışı gibi kalite sinyalleriyle değerlendirilebilir. Platform, güveni korumak için profil
          görünürlüğünü sınırlayabilir, ek belge isteyebilir veya inceleme başlatabilir.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Ödeme ve abonelik</h2>
        <p>
          Öğretmen abonelikleri, öğrenci paketleri, cüzdan yüklemeleri, doğrudan ders ve kurs ödemeleri
          ilgili panelde gösterilen tutar ve koşullara tabidir. Kart ödemeleri ödeme sağlayıcısı üzerinden,
          havale/EFT ödemeleri admin onayıyla ilerler. Başarısız veya uyumsuz ödeme kayıtları mutabakat
          sürecine alınır.
        </p>
        <h2 className="text-base font-semibold text-paper-900">İptal, iade ve uyuşmazlık</h2>
        <p>
          Ders, paket veya ödeme uyuşmazlıklarında platform kayıtları, mesajlar, ders durumu, cüzdan
          hareketleri ve ödeme sağlayıcı bildirimleri birlikte incelenir. İade veya manuel düzeltme
          gerekiyorsa işlem admin audit ve mutabakat kayıtlarıyla izlenir. Nihai ticari/iade politikası
          yayıma alınmadan önce hukuk ve muhasebe danışmanlığıyla netleştirilmelidir.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Sorumluluk sınırı</h2>
        <p>
          Platform, kayıtlı süreçleri ve teknik altyapıyı sunar; kullanıcıların platform dışında yaptığı
          anlaşmalardan, paylaşımlardan veya ödemelerden sorumlu tutulamaz. Güvenli deneyim için iletişim
          ve ödeme adımlarının platform içinde yürütülmesi önerilir.
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
