"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";
import { RequestChat } from "../../../components/RequestChat";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

type MyRequest = {
  id: string;
  status: string;
  branch_id: number;
  created_at: string;
  offers_count: number;
};

type Offer = {
  id: string;
  teacher_id: string;
  status: string;
  message: string;
  proposed_hourly_rate_minor: number | null;
  created_at: string;
  display_name: string;
};

function offerStatusTr(status: string): string {
  switch (status) {
    case "sent":
      return "Beklemede";
    case "accepted":
      return "Kabul edildi";
    case "rejected":
      return "Reddedildi";
    case "withdrawn":
      return "Geri çekildi";
    default:
      return status;
  }
}

function requestStatusTr(status: string): string {
  const m: Record<string, string> = {
    open: "Açık",
    matched: "Eşleşti",
    cancelled: "İptal edildi",
    expired: "Süresi doldu",
  };
  return m[status] ?? status;
}

export default function StudentRequestDetailPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams();
  const requestId = typeof params.requestId === "string" ? params.requestId : "";

  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  /** undefined: henüz yüklenmedi; null: listede yok; nesne: özet */
  const [summary, setSummary] = useState<MyRequest | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const branchName = useMemo(() => {
    if (!summary) return "";
    const b = branches.find((x) => x.id === summary.branch_id);
    return b?.name ?? `Branş #${summary.branch_id}`;
  }, [branches, summary]);

  const load = useCallback(
    async (t: string) => {
      setError(null);
      setOk(null);
      const [b, m] = await Promise.all([
        apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
        apiFetch<{ requests: MyRequest[] }>("/v1/lesson-requests/mine", { token: t }),
      ]);
      setBranches(b.branches);
      const row = m.requests.find((r) => r.id === requestId);
      if (!row) {
        setSummary(null);
        setOffers([]);
        return;
      }
      setSummary(row);
      const o = await apiFetch<{ offers: Offer[] }>(
        `/v1/lesson-requests/${requestId}/offers`,
        { token: t },
      );
      setOffers(o.offers);
    },
    [requestId],
  );

  useEffect(() => {
    if (!token || !requestId) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu talebe erişim izniniz yok.");
      }
    });
  }, [token, requestId, load, router, pathname]);

  async function cancelRequest() {
    if (!token) return;
    if (
      !window.confirm(
        "Bu talebi iptal etmek istediğinize emin misiniz? Bekleyen teklifler reddedilir.",
      )
    ) {
      return;
    }
    setCancelling(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/lesson-requests/${requestId}/cancel`, {
        method: "POST",
        token,
      });
      await load(token);
      setOk("Talep iptal edildi.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cancel_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu talep üzerinde işlem yapma yetkiniz yok.");
      }
    } finally {
      setCancelling(false);
    }
  }

  async function decide(offerId: string, decision: "accept" | "reject") {
    if (!token) return;
    setBusyId(offerId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/lesson-requests/${requestId}/offers/${offerId}/decide`, {
        method: "POST",
        token,
        body: JSON.stringify({ decision }),
      });
      await load(token);
      setOk(
        decision === "accept"
          ? "Teklif kabul edildi; talep eşleşti."
          : "Teklif reddedildi.",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "decide_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu teklif üzerinde işlem yapma yetkiniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">Öğrenci</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Talep ve teklifler
            </h1>
            {summary && (
              <p className="mt-1 text-sm text-zinc-600">
                {branchName} · durum:{" "}
                <span className="font-medium">{requestStatusTr(summary.status)}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/student/panel"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm"
            >
              Abonelik & cüzdan
            </Link>
            <Link
              href="/student/dogrudan-dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Doğrudan ders
            </Link>
            <Link
              href="/ogretmenler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Öğretmen ara
            </Link>
            <Link
              href="/student/requests"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Tüm talepler
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

        {summary === undefined && !error && (
          <div className="mt-8 text-sm text-zinc-600">Yükleniyor…</div>
        )}

        {summary === null && (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
            Bu talep bulunamadı veya size ait değil.
          </div>
        )}

        {summary != null && (
          <div className="mt-8 space-y-3">
            {summary.status === "open" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-zinc-600">
                  Talebi artık istemiyorsanız iptal edebilirsiniz; öğretmenlerle
                  mesajlaşma kapanır.
                </p>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void cancelRequest()}
                  className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelling ? "İptal ediliyor…" : "Talebi iptal et"}
                </button>
              </div>
            )}
            {offers.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
                Henüz teklif yok. Öğretmenler talebi gördükçe burada listelenecek.
              </div>
            ) : (
              offers.map((o) => {
                const canAct =
                  summary.status === "open" && o.status === "sent";
                return (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {o.display_name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {offerStatusTr(o.status)} ·{" "}
                          {new Date(o.created_at).toLocaleString("tr-TR")}
                        </div>
                        {o.proposed_hourly_rate_minor != null && (
                          <div className="mt-2 text-sm text-zinc-700">
                            Önerilen saatlik:{" "}
                            {(o.proposed_hourly_rate_minor / 100).toFixed(2)} TL
                          </div>
                        )}
                        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
                          {o.message}
                        </p>
                      </div>
                      {canAct && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void decide(o.id, "accept")}
                            className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {busyId === o.id ? "…" : "Kabul"}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => void decide(o.id, "reject")}
                            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {(summary.status === "open" || summary.status === "matched") && (
              <RequestChat token={token} requestId={requestId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
