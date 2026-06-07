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
    <article className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
        Gizlilik ve kişisel veriler
      </h1>
      <p className="mt-2 text-sm text-paper-800/75">
        BenimÖğretmenim; öğrenci, öğretmen, veli ve yönetici hesaplarında kişisel verileri yalnızca eğitim
        hizmetini sunmak, güvenliği sağlamak ve yasal yükümlülükleri yerine getirmek için işler.
      </p>
      <section className="mt-10 space-y-4 text-sm leading-relaxed text-paper-800/85">
        <h2 className="text-base font-semibold text-paper-900">Toplanan veriler</h2>
        <p>
          Hesap oluştururken e-posta, görünen ad, rol ve oturum bilgileri; öğretmen profillerinde branş,
          şehir, deneyim, belge, video ve profil açıklamaları; öğrenci tarafında talep, teklif, ders,
          ödev, çalışma planı ve mesaj içerikleri işlenebilir. Veli hesaplarında öğrenci bağlantısı,
          bildirim ve ilerleme bilgileri görüntülenebilir.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Amaç</h2>
        <p>
          Veriler; hesabı işletmek, öğretmen-öğrenci eşleşmesini sağlamak, ödeme ve cüzdan kayıtlarını
          tutmak, canlı ders ve ödev süreçlerini yönetmek, veli bildirimleri göndermek, destek taleplerini
          çözmek, güvenlik kayıtlarını oluşturmak ve mevzuat gerekliliklerini yerine getirmek için kullanılır.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Ödeme ve güvenlik</h2>
        <p>
          Kart ödemelerinde PayTR gibi ödeme sağlayıcıları devreye girebilir; kart bilgileri BenimÖğretmenim
          sunucularında saklanmaz. Platform, ödeme sonucu, tutar, işlem numarası ve cüzdan hareketini
          güvenlik ve finansal kayıt amacıyla işler.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Saklama ve paylaşım</h2>
        <p>
          Veriler hizmet ilişkisi, yasal saklama süreleri, sorun çözümü ve finansal kayıt gereklilikleri
          devam ettiği sürece saklanabilir. Yetkili kamu kurumları, ödeme sağlayıcıları ve teknik hizmet
          sağlayıcıları dışında üçüncü kişilerle gereksiz paylaşım yapılmaması esastır.
        </p>
        <h2 className="text-base font-semibold text-paper-900">Haklarınız</h2>
        <p>
          KVKK kapsamında erişim, düzeltme, silme, işleme itiraz, aktarım yapılan tarafları öğrenme ve
          zarar doğması halinde tazmin talep etme haklarınız vardır. Talepleriniz için{" "}
          <Link href="/iletisim" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            iletişim
          </Link>{" "}
          kanalını kullanabilirsiniz. Nihai hukuki metin şirket bilgileri ve veri sorumlusu detaylarıyla
          birlikte yayıma alınmalıdır.
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
