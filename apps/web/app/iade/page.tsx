import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const iadeUrl = `${publicSiteUrl()}/iade`;

export const metadata: Metadata = {
  title: "İade politikası",
  description:
    "BenimÖğretmenim iade ve iptal koşulları: kurs, doğrudan ders, abonelik, ödev havuzu ve cüzdan bakiyesi.",
  alternates: { canonical: iadeUrl },
};

const sections = [
  {
    title: "Genel ilke",
    body: "Öğrenci platforma ödeme yapar; öğretmen komisyon ödemez. İade talepleri kayıt altına alınır, destek ekibi ve panel üzerinden takip edilir.",
  },
  {
    title: "Kurs kayıtları",
    body: "Kurs ücreti kayıt sırasında cüzdanda güvenceye alınır. İlk ders sonrası iade talebi oluşturabilirsiniz. İkinci derse katılırsanız iade hakkı kapanır. Admin onayı sonrası tutar cüzdanınıza iade edilir.",
  },
  {
    title: "Doğrudan ders anlaşmaları",
    body: "Ders başlamadan iptal: tutar cüzdana iade edilir. Ders tamamlandı: öğretmen hak edişi işlenir, iade yalnızca anlaşmazlık/itiraz sürecinde değerlendirilir.",
  },
  {
    title: "Öğrenci aboneliği",
    body: "Yıllık abonelik dijital hizmettir. Kullanılmayan günler için oransal iade yasal zorunluluklar ve PayTR/mağaza kuralları çerçevesinde değerlendirilir. İptal sonraki dönem yenilemesini durdurur.",
  },
  {
    title: "Ödev / soru havuzu",
    body: "Havuzda bekleyen (henüz öğretmen almamış) gönderiler iptal edilebilir. Yanıtlanmış gönderilerde memnuniyet onayı veya itiraz akışı geçerlidir; haksız reddedilen cevaplar için destek talebi açın.",
  },
  {
    title: "Öğretmen para çekme",
    body: "Onaylanan çekimler 5 iş günü içinde banka hesabınıza aktarılır. Reddedilen çekimlerde tutar cüzdanınıza iade edilir; gerekçe panelde görünür.",
  },
  {
    title: "PayTR / kart iadesi",
    body: "Kart ödemelerinde iade PayTR ve banka süreçlerine tabidir (genelde 3–10 iş günü). Kart bilgisi platform sunucularında saklanmaz.",
  },
  {
    title: "İtiraz ve destek",
    body: "Anlaşmazlık için panelden veya /itiraz sayfasından kayıt açın. Acil durumlar için /iletisim ve uygulama içi destek widget'ını kullanın.",
  },
] as const;

export default function IadePage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">İade politikası</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-800/75">
          Şeffaf iade ve iptal kuralları Tahta benzeri platformlardaki belirsizlik riskini azaltmak için açıkça
          yayımlanır. Nihai metin hukuk onayı ile güncellenebilir.
        </p>
        <ul className="mt-10 space-y-8">
          {sections.map((s) => (
            <li key={s.title} className="border-b border-paper-200 pb-8 last:border-0">
              <h2 className="text-base font-semibold text-paper-900">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/80">{s.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link href="/yardim" className="text-brand-800 underline">
            Yardım
          </Link>
          <Link href="/itiraz" className="text-brand-800 underline">
            İtiraz aç
          </Link>
          <Link href="/iletisim" className="text-brand-800 underline">
            İletişim
          </Link>
          <Link href="/gizlilik" className="text-brand-800 underline">
            Gizlilik
          </Link>
        </div>
      </div>
    </div>
  );
}
