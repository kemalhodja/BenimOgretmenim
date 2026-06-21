import Link from "next/link";
import { VISITOR_START_STEPS } from "./QuickStartBanner";

export function VisitorStartGuide() {
  return (
    <section
      className="mt-8 rounded-3xl border border-edu-indigo-200 bg-white/90 p-5 shadow-[0_18px_55px_rgba(79,70,229,0.1)] backdrop-blur"
      data-testid="visitor-start-guide"
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-edu-indigo-800/80">3 adımda başlayın</div>
      <h2 className="mt-2 text-lg font-semibold text-paper-950">Ne yapmak istediğinizi seçin; platform gerisini gösterir</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/75">
        Kayıt → ihtiyacını seç → panelden takip. Her rol için tek bir sıradaki adım vardır.
      </p>
      <ol className="mt-5 grid gap-2 sm:grid-cols-3">
        {VISITOR_START_STEPS.map((step, index) => (
          <li key={step.label} className="rounded-xl border border-edu-blue-100 bg-white p-3">
            <div className="flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-edu-indigo-100 text-xs font-bold text-edu-indigo-900">
                {index + 1}
              </span>
              <div>
                <div className="text-sm font-semibold text-paper-950">{step.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-paper-800/70">{step.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/kayit?role=student"
          className="rounded-xl bg-edu-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-indigo-800"
        >
          Öğrenci — ücretsiz başla
        </Link>
        <Link
          href="/kayit?role=teacher"
          className="rounded-xl border border-edu-sun-300 bg-edu-sun-50 px-4 py-2.5 text-sm font-semibold text-edu-sun-900 hover:bg-edu-sun-100"
        >
          Öğretmen başvurusu
        </Link>
        <Link
          href="/kayit?role=guardian"
          className="rounded-xl border border-paper-200 bg-white px-4 py-2.5 text-sm font-semibold text-paper-900 hover:bg-paper-50"
        >
          Veli hesabı
        </Link>
        <Link href="/roller" className="self-center px-2 text-sm font-semibold text-brand-800 underline">
          Kim ne yapabilir?
        </Link>
      </div>
    </section>
  );
}
