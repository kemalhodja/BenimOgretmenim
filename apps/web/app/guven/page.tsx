import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";

const guvenUrl = `${publicSiteUrl()}/guven`;

export const metadata: Metadata = {
  title: "Güven ve şeffaflık merkezi",
  description:
    "BenimÖğretmenim'de PayTR ödeme, cüzdan, öğretmen doğrulama, iade/itiraz, KVKK ve destek süreçleri.",
  alternates: { canonical: guvenUrl },
  openGraph: {
    title: "Güven ve şeffaflık merkezi · BenimÖğretmenim",
    description:
      "Öğrenci, veli ve öğretmen için ödeme, doğrulama ve destek süreçleri açıkça anlatılır.",
    url: guvenUrl,
    locale: "tr_TR",
    type: "website",
  },
};

const pillars = [
  {
    title: "Ödeme güvenliği",
    body: "Kart ödemeleri PayTR ile alınır. Tutar ve ödeme sonucu kontrol edilir. Her ödeme kayıt altında tutulur.",
  },
  {
    title: "Cüzdan ve kazanç",
    body: "Öğrenci ödemesi cüzdanda güvenceye alınır. Öğretmenin net kazancı ders sürecine göre panelde görünür.",
  },
  {
    title: "Öğretmen doğrulama",
    body: "Öğretmenin branşı, belgeleri, tanıtımı, ders geçmişi ve yorumları seçim yapmadan önce görünür.",
  },
  {
    title: "Şeffaf fiyat",
    body: "Öğrenci, öğretmen ve kampanya ücretleri ödeme yapmadan önce açıkça gösterilir.",
  },
] as const;

const paymentFlow = [
  "Kullanıcı ödeme yapmadan önce tutarı görür.",
  "Ödeme sonucu sistem tarafından kontrol edilir.",
  "Sorunlu ödemeler yönetici incelemesine alınır.",
  "Yönetici işlem sonucunu notuyla kapatır.",
] as const;

const policies = [
  {
    title: "İade ve itiraz",
    body: "Ders, ödeme, mesaj ve cüzdan kayıtları birlikte incelenir. Karar kayıtlı bilgiye göre verilir.",
  },
  {
    title: "KVKK ve veri",
    body: "Kayıt, iletişim, ödeme ve öğrenme bilgileri hizmeti sunmak ve güvenliği sağlamak için kullanılır.",
  },
  {
    title: "Destek önceliği",
    body: "Ödeme ve erişim sorunları önce ele alınır. Destek talepleri admin panelinde takip edilir.",
  },
] as const;

const roleVisibility = [
  {
    title: "Öğrenci ne görür?",
    body: "Teklifleri, kurs kayıtlarını, güvenceye alınan ödemeleri, canlı ders linklerini ve iade durumunu panelinden takip eder.",
  },
  {
    title: "Öğretmen ne görür?",
    body: "Başvuruları, teklifleri, ders planını, kurs kazançlarını ve para çekme taleplerini kendi panelinde izler.",
  },
  {
    title: "Veli ne görür?",
    body: "Bağlı öğrencinin ders notlarını, ödev durumunu, çalışma planını ve önemli bildirimlerini takip eder.",
  },
] as const;

export default function GuvenPage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section className="rounded-[2rem] border border-paper-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-900">
            Güven ve şeffaflık
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-paper-950 sm:text-4xl">
            BenimÖğretmenim&apos;de ödeme, öğretmen seçimi ve ders süreci kayıtlı ilerler.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-paper-800/70">
            Platform yalnızca öğretmen listesi değildir. Ödeme, ders, kampanya başvurusu ve destek süreci
            kullanıcıların panelinde anlaşılır şekilde görünür.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/fiyatlar"
              className="rounded-2xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Fiyatları incele
            </Link>
            <Link
              href="/kullanim-kosullari"
              className="rounded-2xl border border-paper-200 bg-paper-50 px-4 py-2.5 text-sm font-semibold text-paper-900 hover:border-brand-200 hover:bg-brand-50"
            >
              Kullanım koşulları
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="rounded-2xl border border-paper-200 bg-white p-5">
              <h2 className="text-base font-semibold text-paper-950">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/70">{pillar.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-paper-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-paper-950">Ödeme nasıl korunur?</h2>
            <ol className="mt-4 space-y-3">
              {paymentFlow.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-xl bg-paper-50 p-3 text-sm text-paper-800">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-xl font-semibold">Kampanya ve kurs ödemeleri</h2>
            <p className="mt-3 text-sm leading-7">
              Kampanyalar admin onayından sonra yayına çıkar. Öğrenci ödeme yaptığında tutar önce cüzdanda güvenceye
              alınır. İlk ders sonrası iade hakkı vardır; ikinci derse girilirse iade hakkı kapanır.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-paper-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-paper-950">Kime ne görünür?</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Her rol kendi ihtiyacı olan ödeme, ders ve takip bilgisini görür. Böylece karar ve destek süreci daha hızlı ilerler.
              </p>
            </div>
            <Link href="/kayit" className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100">
              Rolünü seç
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {roleVisibility.map((item) => (
              <article key={item.title} className="rounded-xl border border-paper-200 bg-paper-50 p-4">
                <h3 className="text-sm font-semibold text-paper-950">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-paper-800/70">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {policies.map((policy) => (
            <article key={policy.title} className="rounded-2xl border border-paper-200 bg-white p-5">
              <h2 className="text-base font-semibold text-paper-950">{policy.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper-800/70">{policy.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-lg font-semibold text-brand-950">Güveni nasıl takip ediyoruz?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-brand-900">
            Yönetici panelinde ödemeler, kampanyalar, öğretmen doğrulaması, destek talepleri ve sistem durumu izlenir.
            Böylece sorunlar erken fark edilir ve kayıtlı şekilde çözülür.
          </p>
        </section>
      </main>
    </div>
  );
}
