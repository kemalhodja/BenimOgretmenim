"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

type OpenRequest = {
  id: string;
  branch_id: number;
  branch_name: string | null;
  request_kind?: "regular" | "demo";
  target_teacher_id: string | null;
  topic_text: string | null;
  city_id: number | null;
  district_id: number | null;
  delivery_mode: string;
  note: string | null;
  created_at: string;
  offers_count: number;
};

/** Boş string → null; aksi TL (virgül veya nokta ondalık) → kuruş. */
function parseTlToMinorOptional(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Saatlik ücret için geçerli bir sayı girin (TL).");
  }
  if (n > 1_000_000) {
    throw new Error("Saatlik ücret çok yüksek.");
  }
  const minor = Math.round(n * 100);
  if (!Number.isSafeInteger(minor)) {
    throw new Error("Saatlik ücret çok yüksek.");
  }
  return minor;
}

export default function TeacherRequestsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState<OpenRequest[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<number | "">("");
  const [message, setMessage] = useState("");
  /** İsteğe bağlı; teklifle birlikte API'ye kuruş olarak gider. */
  const [hourlyTl, setHourlyTl] = useState("");
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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

  const refresh = useCallback(async (t: string) => {
    const b = await apiFetch<{ branches: Branch[] }>("/v1/meta/branches");
    setBranches(b.branches);
    const qs = new URLSearchParams();
    if (filterBranchId !== "") qs.set("branchId", String(filterBranchId));
    const r = await apiFetch<{ requests: OpenRequest[] }>(
      `/v1/lesson-requests/open?${qs.toString()}`,
      { token: t },
    );
    setOpen(r.requests);
  }, [filterBranchId]);

  useEffect(() => {
    if (!token) return;
    refresh(token).catch((e) => {
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
  }, [token, filterBranchId, refresh, router, pathname]);

  async function sendOffer(requestId: string) {
    if (!token) return;
    setError(null);
    setOk(null);
    setSendingFor(requestId);
    try {
      if (message.trim().length < 5) throw new Error("Mesaj yazın (min 5)");
      const proposedHourlyRateMinor = parseTlToMinorOptional(hourlyTl);
      const payload: { message: string; proposedHourlyRateMinor?: number } = {
        message: message.trim(),
      };
      if (proposedHourlyRateMinor != null) {
        payload.proposedHourlyRateMinor = proposedHourlyRateMinor;
      }
      await apiFetch(`/v1/lesson-requests/${requestId}/offers`, {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      const request = open.find((r) => r.id === requestId);
      const successMessage =
        request?.request_kind === "demo"
          ? "Demo ders yanıtı gönderildi. Öğrenci kabul ederse 30 dakikalık demo oturumu oluşur."
          : proposedHourlyRateMinor != null
            ? `Teklif gönderildi (saatlik ${(proposedHourlyRateMinor / 100).toFixed(2)} TL).`
            : "Teklif gönderildi.";
      setOk(successMessage);
      setMessage("");
      setHourlyTl("");
      await refresh(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu işlem için öğretmen hesabı gerekir.");
      }
      if (msg.includes("[409]") && msg.includes("insufficient")) {
        setError(
          "Bakiye yetersiz. Aboneliğiniz yoksa teklif göndermek için 300 TL cüzdan bakiyesi gerekir. Cüzdan sayfasından bakiye yükleyin.",
        );
      }
    } finally {
      setSendingFor(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Açık ders talepleri</h1>
          <p className="mt-1 text-sm text-paper-800/65">Gönderdiğiniz teklifler: üst menüden «Teklifler».</p>
        </div>

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

        <div className="mt-6 rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-paper-800">Filtre: Branş</div>
              <select
                value={filterBranchId}
                onChange={(e) =>
                  setFilterBranchId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              >
                <option value="">Tümü</option>
                {leafBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-paper-800">Teklif mesajı</div>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                placeholder="Örn: 5 yıldır LGS matematik…"
              />
            </label>

            <label className="block sm:col-span-2">
              <div className="mb-1 text-sm font-medium text-paper-800">
                Önerilen saatlik ücret (TL, isteğe bağlı)
              </div>
              <input
                value={hourlyTl}
                onChange={(e) => setHourlyTl(e.target.value)}
                inputMode="decimal"
                className="w-full max-w-xs rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                placeholder="Örn: 750 veya 750,50"
              />
              <p className="mt-1 text-xs text-paper-800/55">
                Boş bırakırsanız ücret gösterilmez. Girilen değer kuruşa yuvarlanır.
              </p>
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {open.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-5 text-sm text-paper-800/75 shadow-sm">
              Açık talep yok.
            </div>
          ) : (
            open.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-paper-900">
                      {r.request_kind === "demo" ? "Demo talebi" : "Talep"} #{r.id.slice(0, 8)} ·{" "}
                      {r.branch_name ?? `Branş #${r.branch_id}`} · teklif:{" "}
                      {r.offers_count}
                    </div>
                    {r.request_kind === "demo" && (
                      <div className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-900">
                        Size özel demo ders talebi
                      </div>
                    )}
                    {r.offers_count > 0 && (
                      <Link
                        href={`/teacher/requests/${r.id}`}
                        className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                      >
                        Teklif verdiyseniz: mesajlaş →
                      </Link>
                    )}
                    <div className="mt-1 text-xs text-paper-800/55">
                      {r.delivery_mode} · {new Date(r.created_at).toLocaleString("tr-TR")}
                    </div>
                    {r.topic_text && (
                      <div className="mt-2 text-sm font-medium text-paper-900">
                        Konu: {r.topic_text}
                      </div>
                    )}
                    {r.note && (
                      <div className="mt-2 text-sm text-paper-800">{r.note}</div>
                    )}
                  </div>
                  <button
                    onClick={() => sendOffer(r.id)}
                    disabled={sendingFor === r.id}
                    className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {sendingFor === r.id ? "Gönderiliyor..." : "Teklif gönder"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="mt-6 text-xs text-paper-800/55">
          Liste: öğrencilerin açtığı açık talepler. Talep oluşturma bu panelde yoktur; yalnızca teklif
          verirsiniz.
        </p>
      </div>
    </div>
  );
}

