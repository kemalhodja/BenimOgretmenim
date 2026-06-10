import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const uygulamaUrl = `${publicSiteUrl()}/uygulama`;

const quickAccess = [
  {
    title: "Öğrenci hızlı başlangıç",
    body: "Öğretmen ara, soru gönder, çalışma planını işaretle ve canlı ders bağlantılarına telefondan ulaş.",
    links: [
      { href: "/student/panel", label: "Öğrenci paneli" },
      { href: "/student/odev-sor", label: "Soru gönder" },
      { href: "/student/calisma", label: "Çalışma planı" },
    ],
  },
  {
    title: "Öğretmen hızlı başlangıç",
    body: "Profilini tamamla, teklifleri takip et, soru havuzuna gir ve derslerini yönet.",
    links: [
      { href: "/teacher", label: "Öğretmen paneli" },
      { href: "/teacher/odev-havuzu", label: "Soru havuzu" },
      { href: "/teacher/edit", label: "Profili tamamla" },
    ],
  },
  {
    title: "Veli hızlı takip",
    body: "Öğrencinin plan ilerlemesini, deneme ortalamasını ve ders bildirimlerini gör.",
    links: [
      { href: "/guardian", label: "Veli paneli" },
      { href: "/kayit?role=guardian", label: "Veli hesabı aç" },
    ],
  },
] as const;

const mobileBenefits = [
  { title: "Ders bağlantısı hızlı açılır", body: "Canlı sınıf, bildirim ve panel bağlantıları ana ekrandan tek dokunuşla erişilir." },
  { title: "Soru fotoğrafı kolaylaşır", body: "Öğrenci ödev/soru gönderimini telefondan daha kısa sürede tamamlar." },
  { title: "Öğretmen hızlı yanıtlar", body: "Teklifler, soru havuzu ve ders durumları mobilde daha hızlı kontrol edilir." },
] as const;

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
        ekran kullanabilirsiniz. Android’de Chrome; iPhone’da Safari ile kurulum yapılır.
      </p>

      <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-brand-950">Mobil kullanım neden önemli?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {mobileBenefits.map((benefit) => (
            <div key={benefit.title} className="rounded-xl border border-brand-100 bg-white/80 p-3">
              <h3 className="text-sm font-semibold text-paper-950">{benefit.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-paper-800/70">{benefit.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {quickAccess.map((item) => (
          <div key={item.title} className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-paper-950">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper-800/75">{item.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-900"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

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
            Kısayol oluşunca simgeye dokunarak uygulamayı <strong>tam ekran</strong> açabilirsiniz.
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
          Play Store veya App Store’da görünmek için mağaza kurallarına uygun ayrı bir yayın hazırlığı gerekir.
          Ana ekrana ekleme, kullanıcıların hemen kullanabilmesi için en hızlı yoldur.
        </p>
        <details className="mt-4 rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/90">
          <summary className="cursor-pointer font-medium text-paper-900">
            Mağaza yayını için hazırlık kontrolü
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Google Play:</strong> Uygulama adı, ikon, ekran görüntüleri, gizlilik beyanı
              ve site doğrulaması hazırlanır.
            </li>
            <li>
              <strong>App Store:</strong> Apple geliştirici hesabı, iPhone/iPad ekran görüntüleri,
              gizlilik cevapları ve inceleme süreci gerekir.
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

      <section className="mt-10 rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-brand-950">Telefonda en iyi kullanım</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-brand-900/90">
          <li>Canlı ders bağlantılarına bildirimden veya paneldeki “Dersler” bölümünden girin.</li>
          <li>Soru fotoğrafı için “Soru gönder” sayfasındaki kamera seçeneğini kullanın.</li>
          <li>Öğretmenler için soru havuzu ve teklif ekranlarını ana ekrana eklenen uygulamadan kontrol etmek daha hızlıdır.</li>
        </ul>
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
