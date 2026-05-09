"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

type MyRequest = {
  id: string;
  status: string;
  branch_id: number;
  city_id: number | null;
  district_id: number | null;
  delivery_mode: string;
  created_at: string;
  offers_count: number;
};

export default function StudentRequestsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [topic, setTopic] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const pathWithQuery = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathWithQuery));
      return;
    }
    setToken(t);
  }, [router, pathWithQuery]);

  const leafBranches = useMemo(() => {
    const hasChild = new Set<number>();
    for (const b of branches) if (b.parent_id != null) hasChild.add(b.parent_id);
    return branches.filter((b) => !hasChild.has(b.id));
  }, [branches]);

  useEffect(() => {
    const raw = searchParams.get("branchId");
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setBranchId((prev) => (prev === "" ? n : prev));
  }, [searchParams]);

  async function refresh(t: string) {
    const [b, m] = await Promise.all([
      apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
      apiFetch<{ requests: MyRequest[] }>("/v1/lesson-requests/mine", { token: t }),
    ]);
    setBranches(b.branches);
    setMine(m.requests);
  }

  useEffect(() => {
    if (!token) return;
    refresh(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathWithQuery));
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğrenci hesabı içindir.");
      }
    });
  }, [token, router, pathWithQuery]);

  async function create() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      if (branchId === "") throw new Error("Branş seçin");
      if (topic.trim().length < 2) throw new Error("Ders konusu en az 2 karakter olmalı (zorunlu).");
      await apiFetch("/v1/lesson-requests", {
        method: "POST",
        token,
        body: JSON.stringify({
          branchId,
          topic: topic.trim(),
          deliveryMode: "online",
          availability: { pazartesi: ["18:00-20:00"] },
          note: note || null,
          imageUrls: [],
        }),
      });
      setOk("Talep oluşturuldu.");
      setNote("");
      await refresh(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathWithQuery));
      }
      if (msg.includes("[403]")) {
        setError("Talep oluşturmak için öğrenci hesabı gerekir.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
              Ders taleplerim
            </h1>
            <p className="mt-1 text-sm text-paper-800/65">
              Branş ve konu zorunlu; teklifler için satıra tıklayın.
            </p>
          </div>
        </header>

        {(error || ok) && (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-800"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-paper-200 bg-white p-5">
            <h2 className="text-base font-semibold text-paper-900">Yeni talep</h2>
            <p className="mt-1 text-xs text-paper-800/55">
              Medya için{" "}
              <Link className="font-medium text-brand-800 underline-offset-4 hover:underline" href="/student/odev-sor">
                Ödev sorusu
              </Link>
              , gönderiler:{" "}
              <Link
                className="font-medium text-brand-800 underline-offset-4 hover:underline"
                href="/student/odev-sor/gonderiler"
              >
                liste
              </Link>
              .
            </p>
            <div className="mt-4 space-y-4">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">Branş</div>
                <select
                  value={branchId}
                  onChange={(e) =>
                    setBranchId(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="">Seçiniz</option>
                  {leafBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">Konu</div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="Örn. Türev, paragrafta anlam…"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">Not</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-24 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="İsteğe bağlı ayrıntı…"
                />
              </label>

              <button
                onClick={create}
                disabled={saving}
                className="w-full rounded-xl bg-brand-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {saving ? "Oluşturuluyor..." : "Talep oluştur"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-paper-200 bg-white p-5">
            <h2 className="text-base font-semibold text-paper-900">Talepler</h2>
            <p className="mt-1 text-xs text-paper-800/55">Detay ve teklifler için satıra tıklayın.</p>
            <div className="mt-3 space-y-2">
              {mine.length === 0 ? (
                <div className="text-sm text-paper-800/65">Henüz talep yok.</div>
              ) : (
                mine.map((r) => (
                  <Link
                    key={r.id}
                    href={`/student/requests/${r.id}`}
                    className="flex items-center justify-between rounded-xl border border-paper-100 px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50/25"
                  >
                    <div>
                      <div className="text-sm font-medium text-paper-900">
                        Talep #{r.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-paper-800/55">
                        {r.status} · teklif: {r.offers_count}
                      </div>
                    </div>
                    <div className="text-xs text-paper-800/55">
                      {new Date(r.created_at).toLocaleString("tr-TR")}
                    </div>
                  </Link>
                ))
              )}
            </div>
            <details className="mt-4 rounded-lg border border-paper-200 bg-paper-50/80 px-3 py-2 text-xs text-paper-800/65">
              <summary className="cursor-pointer select-none font-medium text-paper-800/75">
                Yerel geliştirici girişi
              </summary>
              <p className="mt-2 font-mono text-[11px] text-paper-800/65">
                student_dev@… / DevParola1
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

