"use client";

import { useCallback, useEffect, useState } from "react";
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

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">Öğretmen</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Doğrudan ders anlaşmaları
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Öğrenci cüzdanından ödeme yaptığında durum güncellenir; dersi verdikten sonra
              tamamlayarak hak edişinizi alırsınız.{" "}
              <Link href="/teacher/cuzdan" className="font-medium text-brand-800 underline">
                Cüzdan
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher/cuzdan"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Cüzdan
            </Link>
            <Link
              href="/teacher/dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ders oturumları
            </Link>
            <Link
              href="/teacher/kurslar"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Online kurslar
            </Link>
            <Link
              href="/teacher"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Panel
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Henüz kayıt yok. Öğrenciler öğretmen havuzundan sizinle anlaştığında burada
              listelenir.
            </div>
          ) : (
            rows.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {b.student_display_name?.trim() || `Öğrenci · ${b.student_id.slice(0, 8)}…`}
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{b.id}</div>
                    <div className="mt-2 text-xs text-zinc-600">
                      Anlaşılan:{" "}
                      <span className="font-mono font-medium text-zinc-900">
                        {minorToTl(b.agreed_amount_minor)} TL
                      </span>
                      {" · "}
                      <span className="font-medium">{statusTr(b.status)}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
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
