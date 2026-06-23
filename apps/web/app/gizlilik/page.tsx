import type { Metadata } from "next";
import Link from "next/link";
import { kvkkEmail, legalEntityAddress, legalEntityName, supportEmail } from "../lib/legalEntity";
import { publicSiteUrl } from "../lib/siteUrl";

const gizlilikUrl = `${publicSiteUrl()}/gizlilik`;

export const metadata: Metadata = {
  title: "Gizlilik ve KVKK",
  description:
    "Kişisel verilerin işlenmesi, saklanması, çerezler ve KVKK haklarınız hakkında bilgilendirme.",
  alternates: { canonical: gizlilikUrl },
  openGraph: {
    type: "website",
    title: "Gizlilik ve KVKK · BenimÖğretmenim",
    description: "Kişisel veriler ve haklarınız hakkında bilgilendirme.",
    url: gizlilikUrl,
    locale: "tr_TR",
  },
};

export default function GizlilikPage() {
  const entity = legalEntityName();
  const address = legalEntityAddress();
  const support = supportEmail();
  const kvkk = kvkkEmail();

  return (
    <article className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
          Gizlilik ve kişisel veriler
        </h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Son güncelleme: Haziran 2026. Bu metin, {entity} platformunda kişisel verilerin nasıl
          işlendiğini açıklar.
        </p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-paper-800/85">
          <h2 className="text-base font-semibold text-paper-900">Veri sorumlusu</h2>
          <p>
            Veri sorumlusu: <strong>{entity}</strong>
            <br />
            Adres: {address}
            <br />
            Genel iletişim:{" "}
            <a href={`mailto:${support}`} className="font-medium text-brand-800 underline-offset-4 hover:underline">
              {support}
            </a>
            <br />
            KVKK başvuruları:{" "}
            <a href={`mailto:${kvkk}`} className="font-medium text-brand-800 underline-offset-4 hover:underline">
              {kvkk}
            </a>
          </p>

          <h2 className="text-base font-semibold text-paper-900">Toplanan veriler</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Hesap: e-posta, görünen ad, rol, şifre özeti, oturum ve güvenlik kayıtları</li>
            <li>Öğretmen profili: branş, şehir, deneyim, açıklama, belge, video, doğrulama durumu</li>
            <li>Öğrenci / veli: talep, teklif, ders, ödev, çalışma planı, veli bağlantısı, bildirimler</li>
            <li>İletişim: platform içi mesajlar, destek talepleri, canlı ders notları</li>
            <li>Ödeme: işlem tutarı, durum, sağlayıcı referansı, cüzdan hareketleri (kart verisi saklanmaz)</li>
            <li>Teknik: IP, tarayıcı/uygulama bilgisi, hata ve güvenlik logları</li>
          </ul>

          <h2 className="text-base font-semibold text-paper-900">İşleme amaçları</h2>
          <p>
            Veriler; hesabı işletmek, öğretmen–öğrenci eşleşmesini sağlamak, ders ve ödev süreçlerini
            yönetmek, ödeme ve iade kayıtlarını tutmak, veli bilgilendirmesi yapmak, destek ve güvenlik
            sağlamak ile yasal yükümlülükleri yerine getirmek için işlenir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Ödeme ve güvenlik</h2>
          <p>
            Kart ödemeleri PayTR gibi lisanslı ödeme sağlayıcıları üzerinden yapılır; kart numarası ve
            CVV {entity} sunucularında saklanmaz. Platform yalnızca ödeme sonucu, tutar ve işlem
            referansını kayıt altına alır.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Çerezler ve oturum</h2>
          <p>
            Oturum açma, güvenlik (CSRF) ve tercih hatırlama için zorunlu çerezler kullanılır. Üçüncü
            taraf reklam veya profil çıkarma amaçlı çerez kullanılmaz. Tarayıcı ayarlarınızdan çerezleri
            silebilirsiniz; oturum çerezleri kapatılırsa giriş gerektiren özellikler çalışmayabilir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Saklama süreleri</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Hesap verileri: hesap aktif olduğu sürece</li>
            <li>Ödeme ve cüzdan kayıtları: mevzuat ve muhasebe gereklilikleri (genellikle en az 5 yıl)</li>
            <li>Destek ve güvenlik logları: sorun çözümü ve denetim için makul süre (genellikle 1–2 yıl)</li>
            <li>Silme talebi sonrası: yasal saklama zorunluluğu dışında makul sürede anonimleştirme veya silme</li>
          </ul>

          <h2 className="text-base font-semibold text-paper-900">Aktarım ve paylaşım</h2>
          <p>
            Veriler; barındırma, ödeme sağlayıcısı ve zorunlu teknik hizmet sağlayıcılarıyla sınırlı
            paylaşılabilir. Yetkili kamu kurumlarının talepleri yasal çerçevede yanıtlanır. Veriler
            reklam ağlarına satılmaz.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Çocuklar ve veliler</h2>
          <p>
            Platform birincil olarak 13 yaş altına yönelik değildir. Reşit olmayan öğrenciler veli
            gözetiminde hesap açmalıdır. Veli hesapları, bağlı öğrencinin ilerleme ve bildirimlerini
            görüntüleyebilir.
          </p>

          <h2 className="text-base font-semibold text-paper-900">KVKK haklarınız</h2>
          <p>
            Erişim, düzeltme, silme, işlemeye itiraz, aktarım yapılan tarafları öğrenme ve zarar halinde
            tazmin talep etme haklarınız vardır.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Hesap silme talebi:{" "}
              <Link href="/ayarlar/hesap" className="font-medium text-brand-800 underline-offset-4 hover:underline">
                Hesap ayarları
              </Link>
            </li>
            <li>
              Diğer talepler:{" "}
              <a href={`mailto:${kvkk}`} className="font-medium text-brand-800 underline-offset-4 hover:underline">
                {kvkk}
              </a>{" "}
              veya{" "}
              <Link href="/iletisim" className="font-medium text-brand-800 underline-offset-4 hover:underline">
                iletişim
              </Link>
            </li>
          </ul>

          <h2 className="text-base font-semibold text-paper-900">Mobil uygulama (Google Play)</h2>
          <p>
            Android uygulaması, web sitesinin güvenli kabuğudur (Trusted Web Activity). Ek izin
            (konum, kamera vb.) talep etmez; toplanan veriler bu gizlilik metniyle aynıdır.
          </p>

          <h2 className="text-base font-semibold text-paper-900">Değişiklikler</h2>
          <p>
            Bu metin güncellenebilir. Önemli değişiklikler sitede veya e-posta ile duyurulur. Güncel
            sürüm her zaman bu sayfada yayımlanır.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/kullanim-kosullari" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Kullanım koşulları
          </Link>
          <Link href="/iade" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            İade politikası
          </Link>
          <Link href="/iletisim" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            İletişim
          </Link>
          <Link href="/" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Ana sayfa
          </Link>
        </div>
      </div>
    </article>
  );
}
