import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Telefona ekle",
  description:
    "BenimÖğretmenim’i ana ekrana ekleyin (PWA). Android’de tek tık; iPhone’da Safari ile. Google Play ve App Store yayını için gerekenler.",
};

export default function UygulamaPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Uygulama</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper-950 sm:text-3xl">
        Telefona ekle ve tam ekran kullan
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-paper-800/90">
        BenimÖğretmenim bir <strong>web uygulaması</strong> (PWA): mağaza olmadan da ana ekrana
        kısayol eklenebilir. Aşağıdaki adımlar güncel Safari ve Chrome için geçerlidir.
      </p>

      <section id="android" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-semibold text-paper-950">Android (Chrome)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-paper-800/90">
          <li>
            Siteyi Chrome ile açın. Çoğu cihazda altta veya üstte çıkan{" "}
            <strong>“Uygulamayı yükle” / “Ana ekrana ekle”</strong> bildirimini kullanın —{" "}
            <strong>tek dokunuş</strong> yeterlidir.
          </li>
          <li>
            Bildirim çıkmazsa: sağ üst <strong>⋮</strong> menü →{" "}
            <strong>Ana ekrana ekle</strong> veya <strong>Yükle uygulama</strong>.
          </li>
          <li>
            Kısayol oluşunca simgeye dokunarak uygulamayı <strong>tam ekran</strong> (standalone)
            açabilirsiniz.
          </li>
        </ol>
      </section>

      <section id="ios" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-semibold text-paper-950">iPhone / iPad (Safari)</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-800/90">
          Apple, üçüncü taraf tarayıcılarda “tek tık yükleme”ye izin vermez; kurulum{" "}
          <strong>Safari</strong> üzerinden yapılır.
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-paper-800/90">
          <li>
            Bağlantıyı <strong>Safari</strong> ile açın (gerekirse paylaş menüsünden Safari’ye
            gönderin).
          </li>
          <li>
            Ortadaki <strong>Paylaş</strong> simgesine (kare ve yukarı ok) dokunun.
          </li>
          <li>
            Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> deyin, ismi onaylayın.
          </li>
        </ol>
        <p className="mt-3 text-xs text-paper-800/70">
          Ana ekrandan açıldığında üst çubuk sadeleşir; bu, Apple’ın web uygulaması davranışıdır
          (App Store paketi değildir).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-paper-950">Google Play ve App Store</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-800/90">
          Mağazada <strong>“BenimÖğretmenim”</strong> aramasıyla çıkmak için ayrıca bir{" "}
          <strong>mağaza paketi</strong> gerekir; yalnızca web sitesi Play / App Store listesine
          otomatik düşmez.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-paper-800/90">
          <li>
            <strong>Google Play:</strong> Genelde{" "}
            <strong>Trusted Web Activity (TWA)</strong> ile ince bir Android kabuğu; sitede{" "}
            <code className="rounded bg-paper-200/80 px-1 font-mono text-xs">
              /.well-known/assetlinks.json
            </code>{" "}
            dosyası ile uygulama imzası eşleştirilir. Geliştirici şablonu: repoda{" "}
            <code className="rounded bg-paper-200/80 px-1 font-mono text-xs">
              apps/twa-android/assetlinks.template.json
            </code>{" "}
            ve adım listesi{" "}
            <code className="rounded bg-paper-200/80 px-1 font-mono text-xs">
              apps/twa-android/BUILD.txt
            </code>
            . Canlı sitede şimdilik boş{" "}
            <code className="rounded bg-paper-200/80 px-1 font-mono text-xs">[]</code> bırakıldı;
            TWA yayınından önce gerçek JSON ile değiştirin. Android Studio ile açılabilir{" "}
            <strong>Gradle TWA iskeleti</strong> repoda{" "}
            <code className="rounded bg-paper-200/80 px-1 font-mono text-xs">apps/twa-android</code>{" "}
            klasöründedir (<code className="rounded bg-paper-200/80 px-1 font-mono text-xs">
              com.benimogretmenim.twa
            </code>
            ).
          </li>
          <li>
            <strong>App Store:</strong> WebView veya Capacitor benzeri bir{" "}
            <strong>iOS kabuğu</strong> + Apple Developer Program üyeliği + inceleme süreci gerekir
            (Safari PWA ana ekranı mağaza girişi sayılmaz).
          </li>
        </ul>
        <p className="mt-3 text-sm text-paper-800/90">
          Gizlilik ve veri toplama beyanları mağaza formlarında istenir; mevcut{" "}
          <Link href="/gizlilik" className="font-medium text-brand-800 underline">
            Gizlilik
          </Link>{" "}
          ve{" "}
          <Link href="/kullanim-kosullari" className="font-medium text-brand-800 underline">
            Kullanım koşulları
          </Link>{" "}
          sayfalarınız bunun temelidir.
        </p>
      </section>

      <div className="mt-10 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-950">
        <div className="font-medium">Kısayol hazır mı?</div>
        <p className="mt-1 text-brand-900/90">
          Ana sayfaya dönün; Android’de <strong>Yükle</strong> teklifi veya iOS’ta yukarıdaki Safari
          adımları görünür.
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
