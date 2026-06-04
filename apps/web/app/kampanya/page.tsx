import type { Metadata } from "next";
import Link from "next/link";
import { loginHrefWithReturn, registerHrefWithReturn } from "../lib/authRedirect";
import { publicSiteUrl } from "../lib/siteUrl";

const kampanyaUrl = `${publicSiteUrl()}/kampanya`;

const teacherSubscriptionBenefits = [
  "Sınırsız teklif verme ve öğrenci taleplerine yanıt hakkı",
  "Kendi kampanya/reklam ilanını oluşturma: ilk ilan ücretsiz, ikinci ve sonraki yeni ilanlar 1000 TL",
  "Kurs, grup ders, doğrudan ders ve öğretmen vitrini görünürlüğü",
  "Başvuru, bildirim, cüzdan ve ödeme kayıtlarını panelden takip",
] as const;

export const metadata: Metadata = {
  title: "Erken erişim öğretmen aboneliği kampanyası",
  description: "6 ay alana 2 yıl, 1 yıl alana 4 yıl ek süre veren erken erişim öğretmen kampanyası.",
  alternates: { canonical: kampanyaUrl },
  openGraph: {
    type: "website",
    title: "Erken erişim kampanyası · BenimÖğretmenim",
    description: "Öğretmen aboneliğinde erken erişime özel uzun süre avantajı.",
    url: kampanyaUrl,
    locale: "tr_TR",
  },
};

export default function KampanyaPage() {
  const subscribeAfterRegisterHref = registerHrefWithReturn("/teacher");
  const loginAfterTeacherHref = loginHrefWithReturn("/teacher");
  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Erken erişim abonelik kampanyası</h1>
          <p className="mt-2 text-paper-800/75">
            BenimÖğretmenim’de erken erişime katılan öğretmenler, sınırlı dönem kampanyasıyla çok daha uzun
            görünürlük ve teklif hakkı kazanır.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Profilini güçlendir", "Demo talebe yanıt ver", "Pakete dönüştür"].map((x, i) => (
              <div key={x} className="rounded-xl border border-paper-100 bg-paper-50 p-3">
                <div className="text-xs font-semibold text-brand-800">Adım {i + 1}</div>
                <div className="mt-1 text-sm font-medium text-paper-900">{x}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-paper-100 bg-paper-50/80 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/65">
              Örnek paketler
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-900">
              <li>
                <span className="font-semibold">6 ay</span> ·{" "}
                <span className="font-mono text-paper-800/45 line-through">7.500 TL</span>{" "}
                <span className="font-mono font-semibold text-brand-800">1750 TL</span>
                <span className="text-paper-800/70"> · +2 yıl hediye · toplam 30 ay</span>
              </li>
              <li>
                <span className="font-semibold">12 ay</span> ·{" "}
                <span className="font-mono text-paper-800/45 line-through">12.000 TL</span>{" "}
                <span className="font-mono font-semibold text-brand-800">2500 TL</span>
                <span className="text-paper-800/70"> · +4 yıl hediye · toplam 60 ay</span>
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-paper-800/60">
              Kampanya abonelik süresini uzatır; ödeme tutarı değişmeden öğretmen panelindeki teklif, görünürlük
              ve ders akışlarına daha uzun süre erişim sağlar.
            </p>
          </div>
          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">
              Abone öğretmen ne kazanır?
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brand-950">
              {teacherSubscriptionBenefits.map((benefit) => (
                <li key={benefit}>• {benefit}</li>
              ))}
            </ul>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={subscribeAfterRegisterHref}
              className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Kayıt ol
            </Link>
            <Link
              href={loginAfterTeacherHref}
              className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
            >
              Giriş yap
            </Link>
          </div>
        </div>

        <div className="mt-8 text-sm text-paper-800/75">
          <Link href="/" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Ana sayfa
          </Link>
          {" · "}
          <Link href="/fiyatlar" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Güncel fiyat listesi
          </Link>
        </div>
      </div>
    </div>
  );
}

