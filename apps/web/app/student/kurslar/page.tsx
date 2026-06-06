"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type EnrollmentRow = {
  enrollment_id: string;
  enrolled_at: string;
  course_id: string;
  course_title: string;
  course_status: string;
  cohort_id: string;
  cohort_title: string;
  cohort_status: string;
  teacher_display_name: string;
  next_session_id: string | null;
  next_session_index: number | null;
  next_session_title: string | null;
  next_scheduled_start: string | null;
  next_meeting_url: string | null;
  enrollment_price_minor: number;
  enrollment_currency: string;
  enrollment_payment_status: string;
  enrollment_charged_at: string | null;
};

type CourseApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  course_id: string;
  course_title: string;
  cohort_title: string | null;
  starts_at: string | null;
  price_minor: number;
  currency: string;
};

function toLocal(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("tr-TR");
}

function applicationLabel(status: string): string {
  if (status === "approved") return "Ön kayıt onaylandı";
  if (status === "rejected") return "Uygun bulunmadı";
  if (status === "pending") return "Değerlendirmede";
  return status;
}

function applicationHelp(status: string): string {
  if (status === "approved") return "Admin uygunluğu onayladı; kampanya Kurslarım listesine eklendi ve bakiye blokesi açıldı.";
  if (status === "rejected") return "Kontenjan, seviye veya takvim nedeniyle uygun bulunmamış olabilir.";
  if (status === "pending") return "Admin kontenjan, öğretmen ve seviye uygunluğunu kontrol ediyor.";
  return "Başvuru durumu güncellendi.";
}

function enrollmentPaymentLabel(row: EnrollmentRow): string {
  if (row.enrollment_payment_status === "wallet_held") {
    return `${(row.enrollment_price_minor / 100).toFixed(2)} ${row.enrollment_currency} bloke`;
  }
  if (row.enrollment_payment_status === "wallet_charged") {
    return `${(row.enrollment_price_minor / 100).toFixed(2)} ${row.enrollment_currency} tahsil edildi`;
  }
  if (row.enrollment_payment_status === "external_paid") return "Ödeme tamamlandı";
  if (row.enrollment_payment_status === "refunded") return "İptal edildi / iade edildi";
  if (row.enrollment_payment_status === "cancelled") return "İptal edildi";
  return "Ücretsiz / ödeme yok";
}

export default function StudentKurslarPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [applications, setApplications] = useState<CourseApplicationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    setError(null);
    const [enrollments, apps] = await Promise.all([
      apiFetch<{ enrollments: EnrollmentRow[] }>("/v1/courses/student/mine", {
        token: t,
      }),
      apiFetch<{ applications: CourseApplicationRow[] }>("/v1/courses/student/applications", {
        token: t,
      }),
    ]);
    setRows(enrollments.enrollments);
    setApplications(apps.applications);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğrenci hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.cohort_status === "active").length;
    const ready = rows.filter((row) => row.next_session_id && row.next_meeting_url).length;
    const waiting = rows.filter((row) => !row.next_session_id).length;
    const pendingApplications = applications.filter((row) => row.status === "pending").length;
    return { active, ready, waiting, pendingApplications };
  }, [rows, applications]);

  const nextEnrollment = useMemo(
    () =>
      rows
        .filter((row) => row.next_session_id && row.next_scheduled_start)
        .sort(
          (a, b) =>
            new Date(a.next_scheduled_start ?? 0).getTime() -
            new Date(b.next_scheduled_start ?? 0).getTime(),
        )[0] ?? rows.find((row) => row.next_session_id) ?? null,
    [rows],
  );

  const nextAction =
    rows.length === 0
      ? {
          title: "Size uygun kursları keşfedin",
          body: "Kayıt olduğunuz kursların canlı ders takvimi ve sınıf linkleri burada toplanır.",
          href: "/courses",
          label: "Kurs kataloğu",
        }
      : nextEnrollment
        ? {
            title: `Sıradaki kurs dersi: ${nextEnrollment.course_title}`,
            body: `${nextEnrollment.cohort_title} · ${toLocal(nextEnrollment.next_scheduled_start)}. Sınıf linki hazır olduğunda tek tıkla katılabilirsiniz.`,
            href: `/student/kurslar/${nextEnrollment.course_id}/cohort/${nextEnrollment.cohort_id}`,
            label: "Oturumları gör",
          }
        : {
            title: "Kurs planlamasını bekliyorsunuz",
            body: "Öğretmen yeni oturum planladığında bildirim gelir ve sınıf linki bu ekranda görünür.",
            href: "/courses",
            label: "Katalogda keşfet",
          };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kurslarım</h1>
            <p className="mt-1 text-sm text-paper-800/75">
              Kayıtlı olduğunuz gruplar ve canlı ders oturumları.
            </p>
          </div>
          <Link
            href="/courses"
            className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Katalogda keşfet
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Kurs asistanı</div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">{nextAction.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-paper-800/70">{nextAction.body}</p>
            </div>
            <Link
              href={nextAction.href}
              className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-brand-100"
            >
              {nextAction.label}
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Aktif kurs</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.active}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Sınıf linki hazır</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{stats.ready}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Plan bekleyen</div>
            <div className="mt-1 text-2xl font-semibold text-warm-950">{stats.waiting}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Ön kayıt bekleyen</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{stats.pendingApplications}</div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">
                Kurs kampanyası ön kayıtları
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-950">Başvuru durumlarınız</h2>
              <p className="mt-1 text-sm text-paper-800/65">
                Admin kampanyalarında ödeme alınmadan önce ön kayıt ve uygunluk kontrolü yapılır.
              </p>
            </div>
            <Link href="/courses" className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900">
              Yeni kampanya bul
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {applications.length === 0 ? (
              <div className="rounded-xl border border-paper-200 bg-paper-50 p-4 text-sm text-paper-800/60">
                Henüz kurs kampanyası ön kaydınız yok.
              </div>
            ) : (
              applications.map((app) => (
                <article key={app.id} className="rounded-xl border border-paper-200 bg-paper-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-paper-950">{app.course_title}</h3>
                      <p className="mt-1 text-xs text-paper-800/60">
                        {app.cohort_title ?? "Ana grup"} · {app.starts_at ? toLocal(app.starts_at) : "Başlangıç netleşecek"} · {(app.price_minor / 100).toFixed(2)} {app.currency}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-900 ring-1 ring-brand-100">
                      {applicationLabel(app.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-paper-800/60">{applicationHelp(app.status)}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75 shadow-sm">
              Henüz kurs kaydınız yok.{" "}
              <Link href="/courses" className="font-medium text-brand-800 underline">
                Kurslar
              </Link>{" "}
              sayfasından kayıt olabilirsiniz.
            </div>
          ) : (
            rows.map((e) => (
              <div
                key={e.enrollment_id}
                className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-paper-900">{e.course_title}</div>
                    <div className="mt-1 text-xs text-paper-800/55">
                      Grup: {e.cohort_title} · {e.cohort_status} · Öğretmen: {e.teacher_display_name}
                    </div>
                    <div className="mt-2 w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-900 ring-1 ring-brand-100">
                      {enrollmentPaymentLabel(e)}
                    </div>
                    <div className="mt-2 text-xs text-paper-800/75">
                      Sıradaki oturum:{" "}
                      {e.next_session_id ? (
                        <>
                          #{e.next_session_index}
                          {e.next_session_title ? ` · ${e.next_session_title}` : ""} ·{" "}
                          {toLocal(e.next_scheduled_start)}
                        </>
                      ) : (
                        "Henüz planlanmamış veya tamamlandı."
                      )}
                    </div>
                    {e.next_meeting_url ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/classroom/course/${e.next_session_id}`}
                          className="rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-medium text-white"
                        >
                          Sınıfa gir
                        </Link>
                        <a
                          href={e.next_meeting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-xs font-medium text-brand-800 underline"
                        >
                          Harici link
                        </a>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <Link
                      href={`/student/kurslar/${e.course_id}/cohort/${e.cohort_id}`}
                      className="rounded-xl bg-brand-800 px-3 py-2 text-center text-sm font-medium text-white"
                    >
                      Tüm oturumlar
                    </Link>
                    <Link
                      href={`/courses/${e.course_id}`}
                      className="rounded-xl border border-paper-200 bg-white px-3 py-2 text-center text-sm font-medium text-paper-800"
                    >
                      Kurs sayfası
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
