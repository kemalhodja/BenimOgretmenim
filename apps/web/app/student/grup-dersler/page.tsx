"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

type GroupLessonRow = {
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

type Wallet = { balanceMinor: number; currency: string };
type Holds = { activeHoldMinor: number };

function tl(n: number): string {
  return (n / 100).toFixed(2);
}

function toLocal(dt: string): string {
  const d = new Date(dt);
  if (!Number.isFinite(d.getTime())) return dt;
  return d.toLocaleString("tr-TR");
}

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

export default function StudentGroupLessonsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [rows, setRows] = useState<GroupLessonRow[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [activeHoldMinor, setActiveHoldMinor] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [whenLocal, setWhenLocal] = useState(""); // YYYY-MM-DDTHH:mm
  const [creating, setCreating] = useState(false);
  const [joinBusyId, setJoinBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const leafBranches = useMemo(() => {
    const hasChild = new Set<number>();
    for (const b of branches) if (b.parent_id != null) hasChild.add(b.parent_id);
    return branches.filter((b) => !hasChild.has(b.id));
  }, [branches]);

  const load = useCallback(async (t: string) => {
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const [b, r, w, h] = await Promise.all([
        apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
        apiFetch<{ requests: GroupLessonRow[] }>("/v1/group-lessons/open", { token: t }),
        apiFetch<Wallet>("/v1/wallet/me", { token: t }),
        apiFetch<Holds>("/v1/wallet/holds?limit=1", { token: t }),
      ]);
      setBranches(b.branches);
      setRows(r.requests);
      setWallet(w);
      setActiveHoldMinor(h.activeHoldMinor ?? 0);
    } finally {
      setLoading(false);
    }
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

  async function createRequest() {
    if (!token) return;
    setCreating(true);
    setError(null);
    setOk(null);
    try {
      if (branchId === "") throw new Error("Branş seçin");
      if (topic.trim().length < 2) throw new Error("Konu en az 2 karakter olmalı");
      if (!whenLocal) throw new Error("Tarih/saat seçin");
      const plannedStart = new Date(whenLocal).toISOString();
      await apiFetch("/v1/group-lessons", {
        method: "POST",
        token,
        body: JSON.stringify({
          branchId,
          topic: topic.trim(),
          teacherId: teacherId.trim() || null,
          plannedStart,
        }),
      });
      setOk("Grup ders talebi oluşturuldu. Katıldığınız için tutar cüzdanınızda bloke edildi.");
      setTopic("");
      setTeacherId("");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("insufficient_balance") || msg.includes("[409]")) {
        setError("Bakiye yetersiz: katılmak için 1000,00 TL bloke edilebilir bakiye gerekir.");
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu işlem için öğrenci hesabı gerekir.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function join(id: string) {
    if (!token) return;
    setJoinBusyId(id);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/group-lessons/${id}/join`, { method: "POST", token });
      setOk("Katılım alındı. Payınız kadar tutar cüzdanınızda bloke edildi.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "join_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("insufficient_balance") || msg.includes("[409]")) {
        setError("Bakiye yetersiz: mevcut katılımcı sayısına göre payınızı bloke edemiyoruz.");
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu ilana katılma izniniz yok.");
      }
    } finally {
      setJoinBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-500">Öğrenci</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Grup ders talepleri
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Toplam ücret 1000 TL. Katılanlar arasında paylaştırılır; katılınca tutar bloke edilir,
              planlanan dersten 1 saat önce tahsil edilir (1 saat kala katılım kapanır).
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Katıldıktan sonra iptal yoktur. Blokaj ders bitimine kadar kalkmayabilir.
            </p>
            {wallet ? (
              <div className="mt-3 text-xs text-zinc-600">
                Cüzdan:{" "}
                <span className="font-mono font-medium text-zinc-900">
                  {tl(wallet.balanceMinor)} {wallet.currency}
                </span>
                {" · "}
                Bloke:{" "}
                <span className="font-mono font-medium text-zinc-900">
                  {tl(activeHoldMinor)} TL
                </span>
                {" · "}
                Kullanılabilir:{" "}
                <span className="font-mono font-semibold text-brand-800">
                  {tl(Math.max(0, wallet.balanceMinor - activeHoldMinor))} TL
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/student/panel"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm"
            >
              Abonelik & cüzdan
            </Link>
            <Link
              href="/student/requests"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ders talepleri
            </Link>
            <Link
              href="/ogretmenler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Öğretmen ara
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

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Yeni grup dersi talebi</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-zinc-700">Branş</div>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              >
                <option value="">Seçin</option>
                {leafBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-sm font-medium text-zinc-700">Planlanan tarih/saat</div>
              <input
                type="datetime-local"
                value={whenLocal}
                onChange={(e) => setWhenLocal(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="mb-1 text-sm font-medium text-zinc-700">Konu</div>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                placeholder="Örn: Trigonometri — temel özdeşlikler"
                maxLength={200}
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="mb-1 text-sm font-medium text-zinc-700">
                Öğretmen ID (opsiyonel)
              </div>
              <input
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono outline-none focus:border-zinc-400"
                placeholder="UUID (boş bırakabilirsiniz)"
              />
              <div className="mt-1 text-xs text-zinc-500">
                Öğretmen profilinden seçim UI’ını bir sonraki adımda ekleyebiliriz.
              </div>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              Toplam: <span className="font-mono font-medium text-zinc-900">1000,00 TL</span>
            </div>
            <button
              type="button"
              onClick={() => void createRequest()}
              disabled={creating}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? "Oluşturuluyor…" : "İlan oluştur"}
            </button>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Açık ilanlar</h2>
            <button
              type="button"
              onClick={() => token && void load(token)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Yenile
            </button>
          </div>
          {loading ? (
            <div className="mt-4 text-sm text-zinc-600">Yükleniyor…</div>
          ) : (
            <div className="mt-4 space-y-3">
              {rows.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
                  Şu an açık ilan yok.
                </div>
              ) : (
                rows.map((r) => {
                  const count = Math.max(1, Number(r.participants_count ?? 1));
                  const share = ceilDiv(Number(r.total_price_minor ?? 100000), count);
                  const available =
                    wallet ? Math.max(0, wallet.balanceMinor - activeHoldMinor) : null;
                  const canAfford = available == null ? true : available >= share;
                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {r.branch_name ?? `Branş #${r.branch_id}`} · {r.topic_text}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {toLocal(r.planned_start)} · durum: {r.status}
                          </div>
                          <div className="mt-2 text-xs text-zinc-600">
                            Katılımcı: <span className="font-medium">{count}</span> · Kişi başı (şu an):
                            <span className="font-mono font-medium text-zinc-900"> {tl(share)} TL</span>
                          </div>
                          {available != null && (
                            <div className="mt-1 text-xs">
                              {canAfford ? (
                                <span className="text-brand-700">
                                  Bu ilana katılmak için yeterli kullanılabilir bakiye var.
                                </span>
                              ) : (
                                <span className="text-amber-700">
                                  Kullanılabilir bakiye yetersiz. Önce cüzdan yükleyin.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                          <button
                            type="button"
                            disabled={joinBusyId === r.id || !canAfford}
                            onClick={() => void join(r.id)}
                            className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {joinBusyId === r.id ? "…" : "Katıl (blokaj)"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

