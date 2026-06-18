"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { StudentPanelHeader } from "../../components/StudentPanelHeader";

type InstantTeacher = {
  id: string;
  display_name: string;
  rating_avg: string | number | null;
  rating_count: number;
  city_name: string | null;
};

export default function AnlikDersPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<InstantTeacher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [useGuardianCredit, setUseGuardianCredit] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await apiFetch<{ teachers: InstantTeacher[] }>("/v1/teachers/instant-ready", { token });
    setTeachers(r.teachers ?? []);
  }, [token]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "load_failed"));
  }, [load]);

  async function startInstant(teacherId: string) {
    if (!token) return;
    setBusyId(teacherId);
    setError(null);
    setOk(null);
    try {
      const created = await apiFetch<{ session: { id: string } }>("/v1/student-platform/instant-lessons", {
        method: "POST",
        token,
        body: JSON.stringify({ teacherId, durationMinutes: 15 }),
      });
      await apiFetch(`/v1/student-platform/instant-lessons/${created.session.id}/fund`, {
        method: "POST",
        token,
        body: JSON.stringify({ useGuardianCredit }),
      });
      setOk("Anlık ders ödemesi tamam. Öğretmen derse başlayabilir; mesajlar üzerinden iletişim kurabilirsiniz.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "instant_failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <StudentPanelHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-paper-900">Anlık özel ders</h1>
        <p className="mt-1 text-sm text-paper-800/70">
          Gece çalışırken takıldığınızda, şu an derse hazır öğretmenlerle 10–15 dakikalık hızlı soru çözümü.
        </p>

        <label className="mt-4 flex items-center gap-2 text-sm text-paper-900">
          <input
            type="checkbox"
            checked={useGuardianCredit}
            onChange={(e) => setUseGuardianCredit(e.target.checked)}
          />
          Veli güvenli havuz kredisini kullan (varsa)
        </label>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {ok ? <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div> : null}

        <ul className="mt-6 space-y-3">
          {teachers.length === 0 ? (
            <li className="rounded-xl border border-paper-200 bg-white p-4 text-sm text-paper-800/60">
              Şu an hazır öğretmen yok. Öğretmen panelinden &quot;Anlık derse hazırım&quot; açıldığında burada görünür.
            </li>
          ) : (
            teachers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-200 bg-white p-4">
                <div>
                  <div className="font-semibold text-paper-900">{t.display_name}</div>
                  <div className="text-xs text-paper-800/60">
                    {t.city_name ?? "Online"} · {Number(t.rating_avg ?? 0).toFixed(1)} ({t.rating_count} yorum)
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => void startInstant(t.id)}
                  className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId === t.id ? "…" : "Hemen başlat"}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/mesajlar" className="text-brand-800 underline">
            Mesajlar
          </Link>
          <Link href="/student/odev-sor" className="text-brand-800 underline">
            Ödev sor
          </Link>
        </div>
      </div>
    </div>
  );
}
