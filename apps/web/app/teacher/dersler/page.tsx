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
  request_kind?: "regular" | "demo";
  source_request_id: string | null;
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
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [focusTopic, setFocusTopic] = useState<Record<string, string>>({});
  const [nextStepNote, setNextStepNote] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!selected) return;
    setDuration(selected.request_kind === "demo" ? 30 : 60);
  }, [selected]);

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

  async function completeSession(sessionId: string) {
    if (!token || !selectedPkg) return;
    if (!window.confirm("Bu oturumu tamamlandı olarak işaretlemek istiyor musunuz?")) return;
    setBusy(sessionId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/packages/${selectedPkg}/sessions/${sessionId}/complete`, {
        method: "POST",
        token,
      });
      await Promise.all([loadSessions(token, selectedPkg), loadPackages(token)]);
      setOk("Oturum tamamlandı. Öğrenci artık yorum bırakabilir.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "complete_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu oturumu tamamlama izniniz yok.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function submitEvaluation(sessionId: string) {
    if (!token) return;
    const m = mastery[sessionId];
    const topic = focusTopic[sessionId]?.trim() ?? "";
    if (!m || m < 1 || m > 5) {
      setError("Ders değerlendirmesi için 1-5 arası seviye seçin.");
      return;
    }
    if (topic.length < 1) {
      setError("Odak konu yazın.");
      return;
    }
    setBusy(sessionId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/lesson-sessions/${sessionId}/evaluation`, {
        method: "POST",
        token,
        body: JSON.stringify({
          answers: {
            masteryLikert: m,
            focusTopic: topic,
            nextStepNote: nextStepNote[sessionId]?.trim() || undefined,
          },
        }),
      });
      setOk("Ders sonu gelişim özeti kaydedildi; öğrenci/veli bildirimleri oluşturuldu.");
      setMastery((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setFocusTopic((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setNextStepNote((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "evaluation_failed";
      if (msg.includes("evaluation_already_exists") || msg.includes("[409]")) {
        setError("Bu oturum için ders sonu değerlendirmesi daha önce kaydedilmiş.");
      } else if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      } else if (msg.includes("[403]")) {
        setError("Bu değerlendirmeyi kaydetme izniniz yok.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Ders paketleri & oturumlar</h1>
          <p className="mt-1 text-sm text-paper-800/75">
            Teklif kabulüyle paket oluşur; buradan ilk dersi planlayıp meeting linki paylaşın.
          </p>
        </div>

        {(error || ok) && (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-900"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Paketler</h2>
            <p className="mt-1 text-xs text-paper-800/55">Son 50 paket.</p>
            <div className="mt-4 space-y-2">
              {rows.length === 0 ? (
                <div className="text-sm text-paper-800/75">Henüz paket yok.</div>
              ) : (
                rows.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPkg(p.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      selectedPkg === p.id
                        ? "border-brand-200 bg-brand-50"
                        : "border-paper-100 bg-paper-50 hover:bg-paper-100"
                    }`}
                  >
                    <div className="font-medium text-paper-900">
                      {p.student_display_name} · {p.completed_lessons}/{p.total_lessons}
                    </div>
                    {p.request_kind === "demo" && (
                      <div className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                        Demo ders
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-paper-800/55">
                      {p.status} · ödeme: {p.payment_status} ·{" "}
                      {new Date(p.created_at).toLocaleString("tr-TR")}
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-paper-800/45">
                      {p.id}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Oturumlar</h2>
            {!selected ? (
              <div className="mt-4 text-sm text-paper-800/75">Bir paket seçin.</div>
            ) : (
              <>
                <div className="mt-3 rounded-xl border border-paper-100 bg-paper-50 p-3 text-sm">
                  <div className="font-medium text-paper-900">
                    {selected.student_display_name}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/75">
                    {selected.request_kind === "demo" ? "Demo ders" : "Paket"}:{" "}
                    {selected.completed_lessons}/{selected.total_lessons} · {selected.status}
                  </div>
                  {selected.source_request_id && (
                    <div className="mt-2">
                      <Link
                        href={`/teacher/requests/${selected.source_request_id}`}
                        className="text-xs font-medium text-brand-800 underline"
                      >
                        Talep sohbetine git
                      </Link>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block sm:col-span-2">
                    <div className="mb-1 text-xs font-medium text-paper-800">Tarih/saat (yerel)</div>
                    <input
                      type="datetime-local"
                      value={whenLocal}
                      onChange={(e) => setWhenLocal(e.target.value)}
                      className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-paper-800">Süre (dk)</div>
                    <input
                      type="number"
                      min={15}
                      max={240}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full rounded-xl border border-paper-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={!whenLocal || sessions.length === 0}
                  onClick={() => void scheduleFirstOpen()}
                  className="mt-3 rounded-xl bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  İlk oturumu planla
                </button>

                <div className="mt-5 space-y-2">
                  {sessions.length === 0 ? (
                    <div className="text-sm text-paper-800/75">Oturum yok.</div>
                  ) : (
                    sessions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-paper-100 bg-paper-50 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-paper-900">
                            Ders #{s.session_index} · {s.status}
                          </div>
                          <div className="text-xs text-paper-800/55">
                            {toLocal(s.scheduled_start)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-paper-800/75">
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
                        {s.status === "scheduled" && (
                          <button
                            type="button"
                            disabled={busy === s.id}
                            onClick={() => void completeSession(s.id)}
                            className="mt-2 ml-3 inline-block rounded-lg border border-paper-300 bg-white px-2 py-1 text-xs font-medium text-paper-900 hover:bg-paper-100 disabled:opacity-50"
                          >
                            {busy === s.id ? "…" : "Dersi tamamladım"}
                          </button>
                        )}
                        {s.status === "completed" && (
                          <div className="mt-3 rounded-xl border border-paper-100 bg-white p-3">
                            <div className="text-xs font-semibold text-paper-900">
                              Ders sonu mini değerlendirme
                            </div>
                            <p className="mt-1 text-xs text-paper-800/55">
                              Öğrenci panelinde gelişim özeti ve veli bildirimi olarak görünür.
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                              <label className="block sm:col-span-1">
                                <div className="mb-1 text-xs font-medium text-paper-800">Seviye</div>
                                <select
                                  value={mastery[s.id] ?? ""}
                                  onChange={(e) =>
                                    setMastery((prev) => ({
                                      ...prev,
                                      [s.id]: Number(e.target.value),
                                    }))
                                  }
                                  className="w-full rounded-lg border border-paper-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                                >
                                  <option value="">Seç</option>
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <option key={n} value={n}>
                                      {n}/5
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block sm:col-span-2">
                                <div className="mb-1 text-xs font-medium text-paper-800">Odak konu</div>
                                <input
                                  value={focusTopic[s.id] ?? ""}
                                  onChange={(e) =>
                                    setFocusTopic((prev) => ({ ...prev, [s.id]: e.target.value }))
                                  }
                                  className="w-full rounded-lg border border-paper-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                                  placeholder="Örn. Kesir problemleri"
                                />
                              </label>
                              <label className="block sm:col-span-2">
                                <div className="mb-1 text-xs font-medium text-paper-800">Sonraki adım</div>
                                <input
                                  value={nextStepNote[s.id] ?? ""}
                                  onChange={(e) =>
                                    setNextStepNote((prev) => ({ ...prev, [s.id]: e.target.value }))
                                  }
                                  className="w-full rounded-lg border border-paper-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                                  placeholder="Ödev / tekrar önerisi"
                                />
                              </label>
                            </div>
                            <button
                              type="button"
                              disabled={busy === s.id}
                              onClick={() => void submitEvaluation(s.id)}
                              className="mt-3 rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            >
                              {busy === s.id ? "…" : "Gelişim özetini kaydet"}
                            </button>
                          </div>
                        )}
                        <div className="mt-1 text-[11px] font-mono text-paper-800/45">
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

