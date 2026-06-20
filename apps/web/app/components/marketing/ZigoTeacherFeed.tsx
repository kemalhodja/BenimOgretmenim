import Link from "next/link";
import { getServerApiBaseUrl } from "../../lib/api";

type ZigoItem = {
  id: string;
  title: string;
  content_kind: string;
  external_url: string | null;
  branch_slug: string | null;
  target_exam: string | null;
  teacher_display_name: string | null;
  teacher_id: string | null;
  published_at: string | null;
};

const kindLabels: Record<string, string> = {
  tip: "İpucu",
  formula: "Formül",
  video: "Video",
  post: "Paylaşım",
};

async function loadZigoFeed(): Promise<ZigoItem[]> {
  try {
    const api = getServerApiBaseUrl();
    const res = await fetch(`${api}/v1/zigo/teacher-feed`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: ZigoItem[] };
    return Array.isArray(body.items) ? body.items.slice(0, 6) : [];
  } catch {
    return [];
  }
}

type Props = {
  /** Ana sayfa açık tema; öğretmenler sayfası nötr */
  variant?: "home" | "plain";
  maxItems?: number;
};

export async function ZigoTeacherFeed({ variant = "home", maxItems = 6 }: Props) {
  const items = (await loadZigoFeed()).slice(0, maxItems);
  const isHome = variant === "home";

  return (
    <section
      className={isHome ? "border-b border-edu-blue-100 bg-white py-10" : "mt-8"}
      data-testid="zigo-teacher-feed"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className={
                isHome
                  ? "text-xs font-semibold uppercase tracking-[0.22em] text-edu-indigo-700/70"
                  : "text-xs font-semibold uppercase tracking-wide text-brand-800/70"
              }
            >
              Zigo vitrin
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper-950">Öğretmen ipuçları</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
              Doğrulanmış öğretmenlerden kısa ipuçları, formüller ve video linkleri. Keşfet, profilden ders veya soru
              desteği al.
            </p>
          </div>
          <Link
            href="/ogretmenler?verifiedOnly=1&sort=recommended"
            className="text-sm font-semibold text-brand-800 underline underline-offset-4"
          >
            Tüm öğretmenler
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-paper-200 bg-paper-50 p-6 text-sm text-paper-800/70">
            Henüz paylaşılmış ipucu yok. Öğretmenler panelden vitrine içerik ekledikçe burada görünür.{" "}
            <Link href="/kayit?role=teacher" className="font-medium text-brand-800 underline">
              Öğretmen olarak paylaş
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col rounded-2xl border border-paper-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-900">
                    {kindLabels[item.content_kind] ?? item.content_kind}
                  </span>
                  {item.branch_slug ? (
                    <span className="text-[10px] font-medium uppercase text-paper-800/50">{item.branch_slug}</span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug text-paper-950">{item.title}</h3>
                {item.teacher_display_name ? (
                  <p className="mt-2 text-xs text-paper-800/60">{item.teacher_display_name}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {item.teacher_id ? (
                    <Link
                      href={`/ogretmenler/${item.teacher_id}`}
                      className="text-xs font-semibold text-brand-800 underline underline-offset-2"
                    >
                      Profili gör
                    </Link>
                  ) : null}
                  {item.external_url ? (
                    <a
                      href={item.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-paper-800/70 underline underline-offset-2"
                    >
                      Bağlantı
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
