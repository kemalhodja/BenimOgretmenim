"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Row = {
  id: string;
  branch_id: number;
  branch_name: string | null;
  topic_text: string;
  teacher_id: string | null;
  total_price_minor: number;
  currency: string;
  planned_start: string;
  status: string;
  participants_count: number;
};

function tl(n: number): string {
  return (n / 100).toFixed(2);
}

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

function toLocal(dt: string): string {
  const d = new Date(dt);
  if (!Number.isFinite(d.getTime())) return dt;
  return d.toLocaleString("tr-TR");
}

function groupLessonStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Katılıma açık",
    teacher_assigned: "Size atandı",
    scheduled: "Ders planlandı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
  };
  return labels[status] ?? "Durum güncellendi";
}

export default function TeacherGroupLessonsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
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
    const r = await apiFetch<{ requests: Row[] }>("/v1/group-lessons/teacher/open", { token: t });
    setRows(r.requests);
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
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function accept(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/group-lessons/${id}/teacher-accept`, { method: "POST", token });
      setOk("İlan kabul edildi.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "accept_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu ilanı kabul etme izniniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function complete(id: string) {
    if (!token) return;
    if (!window.confirm("Ders bitti mi? Güvenceye alınan ödemeler serbest bırakılacak.")) return;
    setBusyId(id);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/group-lessons/${id}/complete`, { method: "POST", token });
      setOk("Ders tamamlandı.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "complete_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu dersi tamamlama izniniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === "open").length;
    const assigned = rows.filter((r) => r.status === "teacher_assigned" || r.teacher_id).length;
    const scheduled = rows.filter((r) => r.status === "scheduled").length;
    const participants = rows.reduce((sum, r) => sum + Math.max(1, Number(r.participants_count ?? 1)), 0);
    return { open, assigned, scheduled, participants };
  }, [rows]);

  const nextRow =
    rows
      .filter((r) => r.status === "teacher_assigned" || r.teacher_id)
      .sort((a, b) => new Date(a.planned_start).getTime() - new Date(b.planned_start).getTime())[0] ??
    rows[0] ??
    null;
  const nextAction =
    rows.length === 0
      ? {
          title: "Şu an grup ders ilanı yok",
          body: "Yeni ilanlar geldiğinde açık, hedefli veya atanmış olarak burada görünecek.",
        }
      : nextRow?.teacher_id
        ? {
            title: "Atanmış grup dersinizi takip edin",
            body: `${nextRow.topic_text} · ${toLocal(nextRow.planned_start)}. Ders bitince tamamlayarak ödeme sürecini kapatın.`,
          }
        : {
            title: "Kabul edilebilir grup dersleri var",
            body: "Size uygun açık ilanları kabul ederek öğrenci grubuna öğretmen olarak atanabilirsiniz.",
          };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Grup ders ilanları</h1>
          <p className="mt-1 text-sm text-paper-800/75">
            Öğrencilerin açtığı ilanları kabul edin; ders bitince «tamamla» ile ödemeyi serbest bırakın.
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

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Grup ders yönetimi</div>
            <h2 className="mt-1 text-lg font-semibold text-paper-900">{nextAction.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-paper-800/70">{nextAction.body}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Açık ilan</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.open}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Atanmış</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{stats.assigned}</div>
          </div>
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Planlı</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.scheduled}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Katılımcı</div>
            <div className="mt-1 text-2xl font-semibold text-warm-950">{stats.participants}</div>
          </div>
        </section>

        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75 shadow-sm">
              Şu an ilan yok.
            </div>
          ) : (
            rows.map((r) => {
              const count = Math.max(1, Number(r.participants_count ?? 1));
              const share = ceilDiv(Number(r.total_price_minor ?? 100000), count);
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-paper-900">
                        {r.branch_name ?? "Branş bilgisi eksik"} · {r.topic_text}
                      </div>
                      <div className="mt-1 text-xs text-paper-800/55">
                        {toLocal(r.planned_start)} · {groupLessonStatusLabel(r.status)}
                      </div>
                      <div className="mt-2 text-xs text-paper-800/75">
                        Katılımcı: <span className="font-medium">{count}</span> · Kişi başı (şu an):{" "}
                        <span className="font-mono font-medium text-paper-900">
                          {tl(share)} TL
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void accept(r.id)}
                        className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {busyId === r.id ? "…" : "Kabul et"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void complete(r.id)}
                        className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 disabled:opacity-50"
                      >
                        {busyId === r.id ? "…" : "Tamamla"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

