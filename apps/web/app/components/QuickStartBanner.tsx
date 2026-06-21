import Link from "next/link";

export type QuickStartStep = {
  label: string;
  body: string;
  href?: string;
  cta?: string;
};

type QuickStartBannerProps = {
  title: string;
  body: string;
  href: string;
  cta: string;
  eyebrow?: string;
  steps?: readonly QuickStartStep[];
  testId?: string;
};

export function QuickStartBanner({
  title,
  body,
  href,
  cta,
  eyebrow = "Şimdi ne yapmalısınız?",
  steps,
  testId = "quick-start-banner",
}: QuickStartBannerProps) {
  return (
    <section
      className="rounded-2xl border-2 border-brand-300 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm"
      data-testid={testId}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/80">{eyebrow}</div>
          <h2 className="mt-2 text-lg font-semibold text-paper-900 sm:text-xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/75">{body}</p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-800 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-900"
        >
          {cta}
        </Link>
      </div>
      {steps && steps.length > 0 ? (
        <ol className="mt-5 grid gap-2 border-t border-brand-100 pt-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.label} className="rounded-xl border border-white/80 bg-white/85 p-3">
              <div className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-900">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-paper-950">{step.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/70">{step.body}</p>
                  {step.href && step.cta ? (
                    <Link href={step.href} className="mt-2 inline-flex text-xs font-semibold text-brand-800 underline">
                      {step.cta}
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export const STUDENT_START_STEPS: readonly QuickStartStep[] = [
  {
    label: "Hedefini yaz",
    body: "Sınav veya konu hedefini çalışma planına ekle.",
    href: "/student/calisma",
    cta: "Planı aç",
  },
  {
    label: "Takıldığın soruyu gönder",
    body: "Fotoğraf çek; uygun öğretmen yanıtlasın.",
    href: "/student/odev-sor",
    cta: "Soru gönder",
  },
  {
    label: "Öğretmen seç",
    body: "Teklifleri karşılaştır; dersi panelden takip et.",
    href: "/student/requests",
    cta: "Taleplerim",
  },
] as const;

export const TEACHER_START_STEPS: readonly QuickStartStep[] = [
  {
    label: "Profili tamamla",
    body: "Branş, ücret, tanıtım ve belgeler vitrinde görünsün.",
    href: "/teacher/edit",
    cta: "Profili düzenle",
  },
  {
    label: "Taleplere teklif ver",
    body: "Branşına uygun öğrenci taleplerini aç.",
    href: "/teacher/requests",
    cta: "Talepleri gör",
  },
  {
    label: "Dersleri yönet",
    body: "Canlı sınıf bağlantısı ve ders notları burada.",
    href: "/teacher/dersler",
    cta: "Derslerim",
  },
] as const;

export const GUARDIAN_START_STEPS: readonly QuickStartStep[] = [
  {
    label: "Öğrenciyi bağla",
    body: "Öğrenci panelindeki davet kodunu buraya girin.",
    href: "#ogrenci-baglama",
    cta: "Bağlama alanı",
  },
  {
    label: "Bildirimleri oku",
    body: "Ders, ödev ve plan güncellemelerini kaçırmayın.",
    href: "#bildirimler",
    cta: "Bildirimler",
  },
  {
    label: "İlan aç (isteğe bağlı)",
    body: "Öğrenciniz adına öğretmen teklifi toplayın.",
    href: "/guardian/requests",
    cta: "İlanlar",
  },
] as const;

export const VISITOR_START_STEPS: readonly QuickStartStep[] = [
  {
    label: "Hesap aç",
    body: "Öğrenci, öğretmen veya veli rolünü seçin.",
    href: "/kayit",
    cta: "Kayıt ol",
  },
  {
    label: "İhtiyacını seç",
    body: "Öğretmen ara, soru gönder veya ders talebi aç.",
    href: "/ogretmenler",
    cta: "Öğretmen ara",
  },
  {
    label: "Panelden takip et",
    body: "Ödeme, ders ve gelişim kayıtları tek yerde.",
    href: "/login",
    cta: "Giriş yap",
  },
] as const;
