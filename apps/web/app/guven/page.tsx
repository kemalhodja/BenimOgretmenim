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
      "Öğrenci, veli ve öğretmen için ödeme, doğrulama, mutabakat ve destek süreçleri açıkça anlatılır.",
    url: guvenUrl,
    locale: "tr_TR",
    type: "website",
  },
};

const pillars = [
  {
    title: "Ödeme güvenliği",
    body: "Kart ödemeleri PayTR üzerinden ilerler. Callback, tutar kontrolü, idempotency ve ödeme mutabakatı ile her işlem kayıt altına alınır.",
  },
  {
    title: "Cüzdan ve hakediş",
    body: "Cüzdan hareketleri defter mantığıyla tutulur. Öğretmen hakedişi, öğrenci onayı ve platform havuzu kayıtlı şekilde izlenir.",
  },
  {
    title: "Öğretmen doğrulama",
    body: "Profil kalitesi, belge/doküman sinyalleri, video, branş bilgisi, ders geçmişi ve değerlendirmeler görünür güven göstergelerine dönüşür.",
  },
  {
    title: "Şeffaf fiyat",
    body: "Öğrenci yıllık aboneliği, öğretmen erken erişim paketleri ve kampanya ilan ücretleri ödeme adımından önce açıkça gösterilir.",
  },
] as const;

const paymentFlow = [
  "Kullanıcı ödeme adımında tutarı ve hizmet karşılığını görür.",
  "PayTR sonucu sadece doğrulanmış hash ve beklenen tutar ile kabul edilir.",
  "Uyuşmayan, bilinmeyen veya başarısız bildirimler mutabakat kuyruğuna düşer.",
  "Admin çözüm notu ve audit kaydıyla işlem kapatılır.",
] as const;

const policies = [
  {
    title: "İade ve itiraz",
    body: "Ders, kampanya başvurusu, cüzdan hareketi ve mesaj kayıtları birlikte incelenir. Uyuşmazlıklar tek taraflı değil, kayıtlı süreçle değerlendirilir.",
  },
  {
    title: "KVKK ve veri",
    body: "Kayıt, iletişim, ödeme ve öğrenme verileri hizmeti sunmak, güvenliği sağlamak ve yasal yükümlülükleri yerine getirmek için işlenir.",
  },
  {
    title: "Destek SLA",
    body: "Ödeme ve erişim sorunları önceliklidir. Destek talepleri bağlama göre sınıflanır; ödeme riskleri admin panelinde ayrıca görünür.",
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
            BenimÖğretmenim&apos;de ödeme, öğretmen ve öğrenme süreci kayıtlı ilerler.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-paper-800/70">
            Platformun amacı yalnızca öğretmen bulmak değildir. Öğrenci, veli ve öğretmen için paranın,
            dersin, kampanya başvurusunun ve destek sürecinin izlenebilir olmasını sağlamaktır.
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
            <h2 className="text-xl font-semibold text-paper-950">Ödeme akışı nasıl korunur?</h2>
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
            <h2 className="text-xl font-semibold">Kampanya ve özel ders anlaşmaları</h2>
            <p className="mt-3 text-sm leading-7">
              Öğretmen kampanyaları admin onayından sonra public olur. Öğrencinin kampanya bedeli platforma
              ödenmez; başvuru sonrası anlaşma öğretmen ve öğrenci arasında netleştirilir. Platform, ilan
              görünürlüğü, başvuru kaydı ve kötüye kullanım takibi sağlar.
            </p>
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
          <h2 className="text-lg font-semibold text-brand-950">Güveni canlı tutan operasyon</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-brand-900">
            Admin panelinde ödeme mutabakatı, kampanya moderasyonu, öğretmen doğrulama, destek talepleri ve
            sistem sağlığı birlikte takip edilir. Bu sayede sorunlar sadece kullanıcı şikayetiyle değil,
            operasyon sinyalleriyle de görünür hale gelir.
          </p>
        </section>
      </main>
    </div>
  );
}
