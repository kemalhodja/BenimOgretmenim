import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";
import { RoleBasedUygulamaSections } from "./RoleBasedUygulamaSections";

const uygulamaUrl = `${publicSiteUrl()}/uygulama`;

export const metadata: Metadata = {
  title: "Telefona ekle",
  description:
    "BenimÖğretmenim'i telefonunuzun ana ekranına ekleyin. Android ve iPhone için kısa kurulum adımları.",
  alternates: { canonical: uygulamaUrl },
  openGraph: {
    type: "website",
    title: "Telefona ekle · BenimÖğretmenim",
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
          BenimÖğretmenim bir <strong>web uygulaması</strong>: ana ekrana kısayol ekleyerek tam
          ekran kullanabilirsiniz. Android&apos;de Chrome; iPhone&apos;da Safari ile kurulum yapılır.
        </p>

        <RoleBasedUygulamaSections />

        <section id="android" className="mt-10 scroll-mt-28">
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
              Kısayol oluşunca simgeye dokunarak uygulamayı <strong>tam ekran</strong> açabilirsiniz.
            </li>
          </ol>
        </section>

        <section id="ios" className="mt-10 scroll-mt-28">
          <h2 className="text-lg font-semibold text-paper-950">iPhone / iPad (Safari)</h2>
          <p className="mt-2 text-sm leading-relaxed text-paper-800/90">
            Apple, üçüncü taraf tarayıcılarda “tek tık yükleme”ye izin vermez; kurulum{" "}
            <strong>Safari</strong> üzerinden yapılır.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-paper-800/90">
            <li>
              Bağlantıyı <strong>Safari</strong> ile açın (gerekirse paylaş menüsünden Safari&apos;ye
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
            Ana ekrandan açıldığında üst çubuk sadeleşir; bu, Apple&apos;ın web uygulaması davranışıdır
            (App Store paketi değildir).
          </p>
        </section>

        <section id="play" className="mt-10 scroll-mt-28">
          <h2 className="text-lg font-semibold text-paper-950">Mağaza uygulaması (Google Play)</h2>
          <p className="mt-2 text-sm leading-relaxed text-paper-800/85">
            Android için Trusted Web Activity (TWA) paketi hazırlanmıştır. Yayın öncesi DNS,{" "}
            <code className="text-xs">assetlinks.json</code> ve Play Console formları tamamlanmalıdır.
          </p>
          {process.env.NEXT_PUBLIC_PLAY_STORE_URL ? (
            <a
              href={process.env.NEXT_PUBLIC_PLAY_STORE_URL}
              className="mt-4 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google Play&apos;den indir
            </a>
          ) : (
            <p className="mt-3 rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/85">
              Play Store bağlantısı yayın sonrası burada görünecek. Şimdilik{" "}
              <strong>Android (Chrome)</strong> bölümündeki ana ekrana ekleme en hızlı yoldur.
            </p>
          )}
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-paper-800/90">
            <li>Google Play yayını Trusted Web Activity (TWA) olarak hazırlanmıştır.</li>
            <li>Yayın öncesi site adresi doğrulanır ve gizlilik beyanı mağazaya eklenir.</li>
            <li>
              Gizlilik:{" "}
              <Link href="/gizlilik" className="font-medium text-brand-800 underline-offset-4 hover:underline">
                Gizlilik politikası
              </Link>
              {" · "}
              <Link
                href="/kullanim-kosullari"
                className="font-medium text-brand-800 underline-offset-4 hover:underline"
              >
                Kullanım koşulları
              </Link>
            </li>
          </ul>
          <details className="mt-4 rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/90">
            <summary className="cursor-pointer font-medium text-paper-900">
              App Store (iPhone) notu
            </summary>
            <p className="mt-3 text-sm text-paper-800/85">
              iOS için ayrı native paket yok; Safari ile ana ekrana ekleme kullanılır. App Store yayını
              ayrı bir Apple geliştirici süreci gerektirir.
            </p>
          </details>
        </section>
      </div>
    </div>
  );
}
