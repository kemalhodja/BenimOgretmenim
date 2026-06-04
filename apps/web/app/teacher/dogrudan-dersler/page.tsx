"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type DirectBooking = {
  id: string;
  student_id: string;
  agreed_amount_minor: string | number;
  status: string;
  funded_at: string | null;
  completed_at: string | null;
  teacher_payout_minor: string | number | null;
  created_at: string;
  student_display_name: string | null;
};

function minorToTl(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return (n / 100).toFixed(2);
}

function statusTr(s: string): string {
  const m: Record<string, string> = {
    pending_funding: "Ödeme bekleniyor",
    funded: "Ödeme alındı",
    completed: "Tamamlandı",
  };
  return m[s] ?? s;
}

export default function TeacherDogrudanDerslerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<DirectBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    const r = await apiFetch<{ bookings: DirectBooking[] }>(
      "/v1/student-platform/direct-bookings/teacher-mine",
      { token: t },
    );
    setRows(r.bookings);
  }, []);

  useEffect(() => {
    if (!token) return;
    setError(null);
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function completeBooking(bookingId: string) {
    if (!token) return;
    if (
      !window.confirm(
        "Dersi tamamladığınızı onaylıyor musunuz? Öğrencinin ödediği tutardan hak edişiniz cüzdanınıza aktarılır.",
      )
    ) {
      return;
    }
    setBusyId(bookingId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/student-platform/direct-bookings/${bookingId}/complete`, {
        method: "POST",
        token,
      });
      await load(token);
      setOk("Kayıt tamamlandı; hak ediş cüzdanınıza yansıdı.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "complete_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu anlaşmayı tamamlama izniniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    const pending = rows.filter((b) => b.status === "pending_funding").length;
    const funded = rows.filter((b) => b.status === "funded").length;
    const completed = rows.filter((b) => b.status === "completed").length;
    const payoutMinor = rows.reduce((sum, b) => sum + Number(b.teacher_payout_minor ?? 0), 0);
    return { pending, funded, completed, payoutMinor };
  }, [rows]);

  const priorityBooking =
    rows.find((b) => b.status === "funded") ??
    rows.find((b) => b.status === "pending_funding") ??
    rows[0] ??
    null;
  const nextAction =
    rows.length === 0
      ? {
          title: "Henüz doğrudan anlaşma yok",
          body: "Öğrenciler öğretmen profilinizden doğrudan ders başlattığında burada ödeme ve hak ediş akışını izleyeceksiniz.",
          href: "/teacher/edit",
          label: "Profili güçlendir",
        }
      : priorityBooking?.status === "funded"
        ? {
            title: "Tamamlanmayı bekleyen ders var",
            body: `${priorityBooking.student_display_name ?? "Öğrenci"} ödemeyi yaptı. Dersi verdikten sonra tamamlayarak hak edişi cüzdanınıza aktarın.`,
            href: "/teacher/cuzdan",
            label: "Cüzdanı aç",
          }
        : priorityBooking?.status === "pending_funding"
          ? {
              title: "Öğrenci ödemesi bekleniyor",
              body: "Ödeme tamamlandığında bu anlaşma tamamlanabilir duruma geçer.",
              href: "/teacher",
              label: "Panele dön",
            }
          : {
              title: "Doğrudan anlaşmalar güncel",
              body: "Tamamlanan hak edişler cüzdanınıza yansır; yeni anlaşmalar için profil görünürlüğünüzü koruyun.",
              href: "/teacher/cuzdan",
              label: "Cüzdanı aç",
            };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Doğrudan ders anlaşmaları</h1>
          <p className="mt-1 text-sm text-paper-800/75">
            Öğrenci cüzdanından ödeme yaptığında durum güncellenir; dersi verdikten sonra tamamlayarak
            hak edişinizi alırsınız.{" "}
            <Link href="/teacher/cuzdan" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              Cüzdan
            </Link>
            .
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Hak ediş asistanı</div>
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
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Ödeme bekleyen</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.pending}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Tamamlanacak</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{stats.funded}</div>
          </div>
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Tamamlanan</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.completed}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Hak ediş</div>
            <div className="mt-1 text-sm font-semibold text-warm-950">{minorToTl(stats.payoutMinor)} TL</div>
          </div>
        </section>

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75 shadow-sm">
              Henüz kayıt yok. Öğrenciler öğretmen havuzundan sizinle anlaştığında burada
              listelenir.
            </div>
          ) : (
            rows.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-paper-900">
                      {b.student_display_name?.trim() || `Öğrenci · ${b.student_id.slice(0, 8)}…`}
                    </div>
                    <div className="mt-1 font-mono text-xs text-paper-800/55">{b.id}</div>
                    <div className="mt-2 text-xs text-paper-800/75">
                      Anlaşılan:{" "}
                      <span className="font-mono font-medium text-paper-900">
                        {minorToTl(b.agreed_amount_minor)} TL
                      </span>
                      {" · "}
                      <span className="font-medium">{statusTr(b.status)}</span>
                    </div>
                    <div className="mt-1 text-xs text-paper-800/55">
                      Oluşturulma: {new Date(b.created_at).toLocaleString("tr-TR")}
                      {b.funded_at ? (
                        <>
                          {" · "}
                          Ödeme: {new Date(b.funded_at).toLocaleString("tr-TR")}
                        </>
                      ) : null}
                      {b.completed_at ? (
                        <>
                          {" · "}
                          Tamamlandı: {new Date(b.completed_at).toLocaleString("tr-TR")}
                        </>
                      ) : null}
                    </div>
                    {b.status === "completed" && b.teacher_payout_minor != null && (
                      <div className="mt-2 text-xs text-brand-800">
                        Hak ediş (cüzdan):{" "}
                        <span className="font-mono font-semibold">
                          {minorToTl(b.teacher_payout_minor)} TL
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {b.status === "funded" && (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => void completeBooking(b.id)}
                        className="rounded-xl bg-brand-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
                      >
                        {busyId === b.id ? "…" : "Dersi tamamladım"}
                      </button>
                    )}
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
