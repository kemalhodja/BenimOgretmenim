import Link from "next/link";

type Variant = "requests" | "campaigns" | "panel";

const copy: Record<
  Variant,
  { title: string; body: string; primaryHref: string; primaryLabel: string; secondaryHref: string; secondaryLabel: string }
> = {
  requests: {
    title: "Ders talebi = öğrencinin açtığı ilan",
    body: "Öğrenci branş ve konu yazar; siz teklif gönderirsiniz. Bu ekran ders taleplerini listeler — kendi vitrin ilanınız değildir.",
    primaryHref: "/teacher/kampanyalar",
    primaryLabel: "Kampanya ilanı oluştur",
    secondaryHref: "/teacher/kampanyalar/yeni",
    secondaryLabel: "Yeni kampanya",
  },
  campaigns: {
    title: "Kampanya ilanı = sizin vitrin duyurunuz",
    body: "Paket, grup veya tanıtım ilanı yayınlarsınız; öğrenciler başvurur. Öğrenci ders talebine teklif vermek için Teklifler sayfasını kullanın.",
    primaryHref: "/teacher/requests",
    primaryLabel: "Açık ders taleplerine git",
    secondaryHref: "/teacher/teklifler",
    secondaryLabel: "Teklif geçmişi",
  },
  panel: {
    title: "İki farklı öğrenci bulma yolu",
    body: "Ders talebi: öğrenci ilan açar, siz teklif verirsiniz. Kampanya ilanı: siz vitrinde duyuru yayınlarsınız, öğrenci başvurur.",
    primaryHref: "/teacher/requests",
    primaryLabel: "Ders talepleri",
    secondaryHref: "/teacher/kampanyalar",
    secondaryLabel: "Kampanya ilanları",
  },
};

export function TeacherFlowExplainer({ variant }: { variant: Variant }) {
  const c = copy[variant];
  return (
    <section
      className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 text-sm text-paper-900"
      data-testid={`teacher-flow-explainer-${variant}`}
    >
      <h2 className="font-semibold text-brand-950">{c.title}</h2>
      <p className="mt-1 leading-relaxed text-paper-800/80">{c.body}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link href={c.primaryHref} className="font-medium text-brand-800 underline">
          {c.primaryLabel}
        </Link>
        <Link href={c.secondaryHref} className="font-medium text-paper-800/70 underline">
          {c.secondaryLabel}
        </Link>
      </div>
    </section>
  );
}
