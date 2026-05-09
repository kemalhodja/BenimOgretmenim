import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const uygulamaUrl = `${publicSiteUrl()}/uygulama`;

export const metadata: Metadata = {
  title: "Telefona ekle",
  description:
    "BenimÖğretmenim'i ana ekrana ekleyin (PWA). Android'de tek tık; iPhone'da Safari ile. Google Play ve App Store yayını için gerekenler.",
  alternates: { canonical: uygulamaUrl },
  openGraph: {
    type: "website",
    title: "PWA — telefona ekle · BenimÖğretmenim",
    description: "Ana ekrana ekleme ve tam ekran kullanım.",
    url: uygulamaUrl,
    locale: "tr_TR",
  },
};

export default function UygulamaPage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-paper-950 sm:text-3xl">
        Telefona ekle
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-paper-800/85">
        BenimÖğretmenim bir <strong>web uygulaması</strong> (PWA): ana ekrana kısayol ekleyerek tam
        ekran kullanabilirsiniz. Android’de Chrome; iPhone’da Safari ile kurulum yapılır.
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
        <h2 className="text-lg font-semibold text-paper-950">Mağaza uygulaması</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-800/85">
          Play veya App Store’da görünmek için siteye ek olarak bir mağaza paketi gerekir; tarayıcıdan
          eklenen PWA kısayolu mağaza girişi sayılmaz.
        </p>
        <details className="mt-4 rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/90">
          <summary className="cursor-pointer font-medium text-paper-900">
            Geliştirici notları (TWA, dosya yolları, iOS)
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Google Play:</strong> Çoğu kurulumda{" "}
              <strong>Trusted Web Activity (TWA)</strong>; sitede{" "}
              <code className="rounded bg-paper-100 px-1 font-mono text-xs">
                /.well-known/assetlinks.json
              </code>{" "}
              ile imza eşlemesi. Repoda şablon:{" "}
              <code className="rounded bg-paper-100 px-1 font-mono text-xs">
                apps/twa-android/assetlinks.template.json
              </code>
              , adımlar:{" "}
              <code className="rounded bg-paper-100 px-1 font-mono text-xs">
                apps/twa-android/BUILD.txt
              </code>
              , iskelet:{" "}
              <code className="rounded bg-paper-100 px-1 font-mono text-xs">apps/twa-android</code> (
              <code className="rounded bg-paper-100 px-1 font-mono text-xs">
                com.benimogretmenim.twa
              </code>
              ).
            </li>
            <li>
              <strong>App Store:</strong> WebView / Capacitor benzeri iOS kabuğu ve Apple Developer
              Program + inceleme gerekir.
            </li>
          </ul>
          <p className="mt-3 text-sm text-paper-800/85">
            Mağaza formlarında gizlilik beyanı istenir; temel metinler{" "}
            <Link href="/gizlilik" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              Gizlilik
            </Link>{" "}
            ve{" "}
            <Link
              href="/kullanim-kosullari"
              className="font-medium text-brand-800 underline-offset-4 hover:underline"
            >
              Kullanım koşulları
            </Link>
            .
          </p>
        </details>
      </section>

      <div className="mt-10 rounded-xl border border-paper-200 bg-white p-5 text-sm">
        <div className="font-medium text-paper-900">Kurulum için</div>
        <p className="mt-1 text-paper-800/75">
          Siteyi açın; Android’de yükleme teklifi veya iOS’ta yukarıdaki Safari adımları görünür.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
        >
          Ana sayfa
        </Link>
      </div>
      </div>
    </div>
  );
}
