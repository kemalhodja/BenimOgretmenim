import Link from "next/link";

const STEPS = [
  {
    title: "Kayıt açın",
    body: "Giriş yaptıktan sonra konu, açıklama ve varsa ilgili ders/ödeme numarasını girin. Her itiraz sistemde numaralandırılır.",
  },
  {
    title: "İnceleme",
    body: "Destek ekibi en geç 24 saat içinde yanıt verir. Gerekirse sizden ek bilgi istenir; durum panelde görünür.",
  },
  {
    title: "Çözüm",
    body: "İade, hesap düzeltmesi veya anlaşmazlık kapatma kararı size bildirilir. İade koşulları için iade politikasını inceleyin.",
  },
] as const;

export function ItirazIntro() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-paper-900">İtiraz ve anlaşmazlık</h1>
      <p className="mt-2 text-sm leading-relaxed text-paper-800/75">
        Ödeme, ders, ödev veya hesap durumu hakkında kayıt açın. Her itiraz numarası ile takip edilir; sebepsiz
        engel veya geciken ödeme şikayetlerine karşı şeffaf süreç.
      </p>
      <p className="mt-2 text-sm">
        <Link href="/iade" className="text-brand-800 underline">
          İade politikası
        </Link>
        {" · "}
        <Link href="/yardim" className="text-brand-800 underline">
          Yardım
        </Link>
        {" · "}
        <Link href="/iletisim" className="text-brand-800 underline">
          İletişim
        </Link>
      </p>
      <ol className="mt-8 space-y-4 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3 text-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-900">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-paper-900">{step.title}</p>
              <p className="mt-1 leading-relaxed text-paper-800/75">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
