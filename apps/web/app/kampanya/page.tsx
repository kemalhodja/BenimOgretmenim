import type { Metadata } from "next";
import Link from "next/link";
import { AuthEntryLink } from "../components/AuthEntryLink";
import { loginHrefWithReturn, registerHrefWithReturn } from "../lib/authRedirect";
import { publicSiteUrl } from "../lib/siteUrl";

const kampanyaUrl = `${publicSiteUrl()}/kampanya`;

const teacherSubscriptionBenefits = [
  "Sınırsız teklif verme ve öğrenci taleplerine yanıt hakkı",
  "Kendi kampanya/reklam ilanını oluşturma: ilk ilan ücretsiz, sonraki ilanlar için 1000 TL",
  "Kurs, grup ders, doğrudan ders ve öğretmen vitrini görünürlüğü",
  "Başvuru, bildirim, cüzdan ve ödeme kayıtlarını panelden takip",
] as const;

const campaignHighlights = [
  {
    title: "6 ay abonelik alana",
    paid: "1750 TL",
    gift: "24 ay hediye",
    total: "30 ay kullanım",
    body: "6 ay abonelik satın alınır. 24 ay ücretsiz hediye süre hesaba otomatik eklenir. Toplam kullanım 30 ay olur.",
  },
  {
    title: "12 ay abonelik alana",
    paid: "2500 TL",
    gift: "48 ay hediye",
    total: "60 ay kullanım",
    body: "12 ay abonelik satın alınır. 48 ay ücretsiz hediye süre hesaba otomatik eklenir. Toplam kullanım 60 ay olur.",
  },
] as const;

export const metadata: Metadata = {
  title: "İlk 500 öğretmene erken erişim hediyesi",
  description: "9 Eylül lansmanına özel: 6 ay aboneliğe 24 ay, 12 ay aboneliğe 48 ay ücretsiz hediye süre.",
  alternates: { canonical: kampanyaUrl },
  openGraph: {
    type: "website",
    title: "İlk 500 öğretmene erken erişim hediyesi · BenimÖğretmenim",
    description: "İlk 500 öğretmene özel: 6 ay aboneliğe 24 ay, 12 ay aboneliğe 48 ay ücretsiz hediye süre.",
    url: kampanyaUrl,
    locale: "tr_TR",
  },
};

export default function KampanyaPage() {
  const subscribeAfterRegisterHref = registerHrefWithReturn("/teacher");
  const loginAfterTeacherHref = loginHrefWithReturn("/teacher");
  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="overflow-hidden rounded-[2rem] border border-warm-200 bg-white text-sm shadow-sm">
          <div className="bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_52%,#ecfeff_100%)] p-6">
            <div className="inline-flex rounded-full border border-warm-200 bg-warm-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-warm-900">
              Erken erişim kampanyası
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-paper-900">
              İlk 500 öğretmene erken erişim hediyesi
            </h1>
            <p className="mt-2 max-w-2xl leading-7 text-paper-800/75">
              BenimÖğretmenim’de lansman tarihi 9 Eylül. Erken erişime özel hediyemiz net:
              6 ay abonelik alan öğretmene 24 ay, 12 ay abonelik alan öğretmene 48 ay ücretsiz hediye süre veriyoruz.
              Kampanya 9 Eylül’e kadar veya ilk 500 öğretmen kontenjanı dolana kadar geçerlidir.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-paper-200 bg-white px-3 py-1.5 text-xs font-bold text-paper-900 shadow-sm">
              Bitiş: 9 Eylül veya ilk 500 öğretmen
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wide text-paper-800/50">Kimler için?</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-900">Yeni veya mevcut öğretmen aboneliği alan ilk 500 öğretmen.</p>
              </div>
              <div className="rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wide text-paper-800/50">Ne öderim?</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-900">6 ay için 1750 TL veya 12 ay için 2500 TL kampanya fiyatı.</p>
              </div>
              <div className="rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wide text-paper-800/50">Hediye nasıl eklenir?</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-900">Ödeme tamamlanınca hediye süre abonelik bitişine otomatik eklenir.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {campaignHighlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm">
                  <div className="text-sm font-bold uppercase tracking-wide text-warm-800">{item.title}</div>
                  <div className="mt-4 grid gap-2 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                    <div className="rounded-xl border border-paper-200 bg-paper-50 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-paper-800/55">Satın alınan</div>
                      <div className="mt-1 text-lg font-bold text-paper-950">{item.paid}</div>
                    </div>
                    <div className="text-lg font-bold text-paper-800/45">+</div>
                    <div className="rounded-xl border border-warm-200 bg-warm-50 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-warm-900/60">Hediye süre</div>
                      <div className="mt-1 text-lg font-bold text-warm-950">{item.gift}</div>
                    </div>
                    <div className="text-lg font-bold text-paper-800/45">=</div>
                    <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/60">Toplam kullanım</div>
                      <div className="mt-1 text-lg font-bold text-brand-950">{item.total}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-paper-800/70">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {["Profilini güçlendir", "Demo talebe yanıt ver", "Pakete dönüştür"].map((x, i) => (
              <div key={x} className="rounded-xl border border-paper-100 bg-paper-50 p-3">
                <div className="text-xs font-semibold text-brand-800">Adım {i + 1}</div>
                <div className="mt-1 text-sm font-medium text-paper-900">{x}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-paper-100 bg-paper-50/80 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/65">
              Fiyat ve hediye süre özeti
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-900">
              <li>
                <span className="font-semibold">6 ay</span> ·{" "}
                <span className="font-mono text-paper-800/45 line-through">14.000 TL</span>{" "}
                <span className="font-mono font-semibold text-brand-800">1750 TL</span>
                <span className="text-paper-800/70"> · 24 ay ücretsiz hediye · toplam 30 ay kullanım</span>
              </li>
              <li>
                <span className="font-semibold">12 ay</span> ·{" "}
                <span className="font-mono text-paper-800/45 line-through">20.000 TL</span>{" "}
                <span className="font-mono font-semibold text-brand-800">2500 TL</span>
                <span className="text-paper-800/70"> · 48 ay ücretsiz hediye · toplam 60 ay kullanım</span>
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-paper-800/60">
              Üstü çizili tutar yalnızca karşılaştırma içindir. Bugün ödenecek tutar kampanya fiyatıdır;
              hediye süre otomatik eklenir. Kampanya ilk 500 öğretmen aboneliği için geçerlidir.
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
              Kampanyayla öğretmen kaydı aç
            </Link>
            <Link
              href={loginAfterTeacherHref}
              className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
            >
              Öğretmen paneline gir
            </Link>
          </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-paper-800/75">
          <Link href="/" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Ana sayfa
          </Link>
          {" · "}
          <AuthEntryLink path="/fiyatlar" className="font-medium text-brand-800 underline-offset-4 hover:underline">
            Güncel fiyat listesi
          </AuthEntryLink>
        </div>
      </div>
    </div>
  );
}

