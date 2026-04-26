"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type TeacherPackage = {
  id: string;
  status: string;
  payment_status: string;
  total_lessons: number;
  completed_lessons: number;
  created_at: string;
  student_id: string;
  student_display_name: string;
};

type SessionRow = {
  id: string;
  session_index: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  delivery_mode: string;
  meeting_url: string | null;
  status: string;
};

function toLocal(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("tr-TR");
}

function parseIsoLocalToUtcIso(input: string): string {
  // input: "YYYY-MM-DDTHH:mm" (local)
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) throw new Error("Tarih/saat geçersiz.");
  return d.toISOString();
}

export default function TeacherDerslerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<TeacherPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [whenLocal, setWhenLocal] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const loadPackages = useCallback(async (t: string) => {
    const r = await apiFetch<{ packages: TeacherPackage[] }>("/v1/packages/teacher/mine", {
      token: t,
    });
    setRows(r.packages);
  }, []);

  const loadSessions = useCallback(
    async (t: string, pkgId: string) => {
      const r = await apiFetch<{ sessions: SessionRow[] }>(`/v1/packages/${pkgId}/sessions`, {
        token: t,
      });
      setSessions(r.sessions);
    },
    [],
  );

  useEffect(() => {
    if (!token) return;
    setError(null);
    loadPackages(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
      }
    });
  }, [token, loadPackages, router, pathname]);

  useEffect(() => {
    if (!token || !selectedPkg) return;
    setError(null);
    loadSessions(token, selectedPkg).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_sessions_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu paket oturumlarına erişim izniniz yok.");
      }
    });
  }, [token, selectedPkg, loadSessions, router, pathname]);

  const selected = useMemo(
    () => rows.find((x) => x.id === selectedPkg) ?? null,
    [rows, selectedPkg],
  );

  async function scheduleFirstOpen() {
    if (!token || !selectedPkg) return;
    setError(null);
    setOk(null);
    try {
      const s = sessions.find((x) => x.status === "scheduled") ?? null;
      if (!s) throw new Error("Planlanacak oturum bulunamadı.");
      if (!whenLocal) throw new Error("Tarih/saat seçin.");

      const scheduledStart = parseIsoLocalToUtcIso(whenLocal);
      setBusy(s.id);
      await apiFetch(
        `/v1/packages/${selectedPkg}/sessions/${s.id}/schedule`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            scheduledStart,
            durationMinutes: duration,
          }),
        },
      );
      await loadSessions(token, selectedPkg);
      setOk("Oturum planlandı.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "schedule_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu oturumu planlama izniniz yok.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-500">Öğretmen</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Ders paketleri & oturumlar
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Teklif kabulüyle paket oluşur; buradan ilk dersi planlayıp meeting linki paylaşın.
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
              href="/teacher/dogrudan-dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Doğrudan dersler
            </Link>
            <Link
              href="/teacher/kurslar"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Online kurslar
            </Link>
            <Link
              href="/teacher"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Panele dön
            </Link>
          </div>
        </div>

        {(error || ok) && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-900"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Paketler</h2>
            <p className="mt-1 text-xs text-zinc-500">Son 50 paket.</p>
            <div className="mt-4 space-y-2">
              {rows.length === 0 ? (
                <div className="text-sm text-zinc-600">Henüz paket yok.</div>
              ) : (
                rows.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPkg(p.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      selectedPkg === p.id
                        ? "border-brand-200 bg-brand-50"
                        : "border-zinc-100 bg-zinc-50 hover:bg-zinc-100"
                    }`}
                  >
                    <div className="font-medium text-zinc-900">
                      {p.student_display_name} · {p.completed_lessons}/{p.total_lessons}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {p.status} · ödeme: {p.payment_status} ·{" "}
                      {new Date(p.created_at).toLocaleString("tr-TR")}
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-zinc-400">
                      {p.id}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Oturumlar</h2>
            {!selected ? (
              <div className="mt-4 text-sm text-zinc-600">Bir paket seçin.</div>
            ) : (
              <>
                <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm">
                  <div className="font-medium text-zinc-900">
                    {selected.student_display_name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Paket: {selected.completed_lessons}/{selected.total_lessons} · {selected.status}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block sm:col-span-2">
                    <div className="mb-1 text-xs font-medium text-zinc-700">Tarih/saat (yerel)</div>
                    <input
                      type="datetime-local"
                      value={whenLocal}
                      onChange={(e) => setWhenLocal(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-zinc-700">Süre (dk)</div>
                    <input
                      type="number"
                      min={15}
                      max={240}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={!whenLocal || sessions.length === 0}
                  onClick={() => void scheduleFirstOpen()}
                  className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  İlk oturumu planla
                </button>

                <div className="mt-5 space-y-2">
                  {sessions.length === 0 ? (
                    <div className="text-sm text-zinc-600">Oturum yok.</div>
                  ) : (
                    sessions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-zinc-900">
                            Ders #{s.session_index} · {s.status}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {toLocal(s.scheduled_start)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          {s.delivery_mode} · süre: {s.duration_minutes ?? "—"} dk
                        </div>
                        {s.meeting_url && (
                          <a
                            href={s.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                          >
                            Meeting linkini aç
                          </a>
                        )}
                        <div className="mt-1 text-[11px] font-mono text-zinc-400">
                          {busy === s.id ? "…" : s.id}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

