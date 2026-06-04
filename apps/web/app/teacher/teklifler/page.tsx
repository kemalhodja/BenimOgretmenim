"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type OfferRow = {
  offer_id: string;
  offer_status: string;
  message: string;
  proposed_hourly_rate_minor: number | null;
  offer_created_at: string;
  request_id: string;
  request_status: string;
  branch_id: number;
  branch_name: string | null;
  request_kind?: "regular" | "demo";
  target_teacher_id: string | null;
  city_id: number | null;
  delivery_mode: string;
  request_note_preview: string | null;
  request_created_at: string;
  package_id: string | null;
  package_status: string | null;
  package_payment_status: string | null;
  first_session_id: string | null;
  first_session_status: string | null;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function statusTr(s: string): string {
  const m: Record<string, string> = {
    sent: "Gönderildi",
    accepted: "Kabul edildi",
    rejected: "Reddedildi",
    withdrawn: "Geri çekildi",
    open: "Açık talep",
    matched: "Eşleşti",
    cancelled: "İptal",
    expired: "Süresi doldu",
  };
  return m[s] ?? s;
}

export default function TeacherTekliflerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ offers: OfferRow[] }>(
          "/v1/lesson-requests/my-offers?limit=50",
          { token },
        );
        setRows(r.offers);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "load_failed";
        setError(msg);
        if (msg.includes("[401]")) {
          clearToken();
          router.replace(loginHrefWithReturn(pathname));
        }
        if (msg.includes("[403]")) {
          setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
        }
      }
    })();
  }, [token, router, pathname]);

  async function withdrawOffer(requestId: string, offerId: string) {
    if (!token) return;
    if (
      !window.confirm(
        "Bu teklifi geri çekmek istediğinize emin misiniz? Talep açık kalmaya devam eder.",
      )
    ) {
      return;
    }
    setWithdrawingId(offerId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(
        `/v1/lesson-requests/${requestId}/offers/${offerId}/withdraw`,
        { method: "POST", token },
      );
      const r = await apiFetch<{ offers: OfferRow[] }>(
        "/v1/lesson-requests/my-offers?limit=50",
        { token },
      );
      setRows(r.offers);
      setOk("Teklif geri çekildi.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "withdraw_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu işlem için öğretmen hesabı gerekir.");
      }
    } finally {
      setWithdrawingId(null);
    }
  }

  if (!token) return null;

  const sentCount = rows.filter((row) => row.offer_status === "sent").length;
  const acceptedCount = rows.filter((row) => row.offer_status === "accepted").length;
  const rejectedCount = rows.filter((row) => row.offer_status === "rejected").length;
  const inFlightCount = rows.filter((row) => row.offer_status === "accepted" && row.package_status === "active").length;

  return (
    <div className="min-h-screen bg-paper-50">
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Verdiğim teklifler</h1>
        <p className="mt-1 text-sm text-paper-800/75">
          Talep ve teklif durumu; sohbet için ilgili talep satırına gidin. Yeni teklif için: üst menü
          «Talepler».
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

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Bekleyen</div>
          <div className="mt-1 text-2xl font-semibold text-paper-900">{sentCount}</div>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Kabul</div>
          <div className="mt-1 text-2xl font-semibold text-brand-950">{acceptedCount}</div>
        </div>
        <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Reddedilen</div>
          <div className="mt-1 text-2xl font-semibold text-paper-900">{rejectedCount}</div>
        </div>
        <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Aktif paket</div>
          <div className="mt-1 text-2xl font-semibold text-warm-950">{inFlightCount}</div>
        </div>
      </section>

      <div className="mt-8 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75 shadow-sm">
            Henüz teklif yok.{" "}
            <Link href="/teacher/requests" className="font-medium text-brand-800 underline">
              Açık taleplere göz atın
            </Link>
            .
          </div>
        ) : (
          rows.map((o) => (
            <div
              key={o.offer_id}
              className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-paper-900">
                    {o.request_kind === "demo" ? "Demo talebi" : "Talep"} #
                    {o.request_id.slice(0, 8)} · {o.branch_name ?? `Branş ${o.branch_id}`}
                  </div>
                  {o.request_kind === "demo" && (
                    <div className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-900">
                      Demo ders
                    </div>
                  )}
                  <div className="mt-1 text-xs text-paper-800/55">
                    Talep: {statusTr(o.request_status)} · Teklif:{" "}
                    {statusTr(o.offer_status)}
                  </div>
                  <div className="mt-1 text-xs text-paper-800/55">
                    {o.delivery_mode} · {new Date(o.offer_created_at).toLocaleString("tr-TR")}
                  </div>
                  {o.request_note_preview && (
                    <p className="mt-2 line-clamp-2 text-sm text-paper-800">
                      {o.request_note_preview}
                    </p>
                  )}
                  {o.proposed_hourly_rate_minor != null && (
                    <div className="mt-2 text-xs text-paper-800/75">
                      Önerilen saatlik: {minorToTl(o.proposed_hourly_rate_minor)} TL
                    </div>
                  )}
                  {o.offer_status === "accepted" && (
                    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-xs text-brand-950">
                      <div className="font-semibold">Paket akışı başladı</div>
                      <div className="mt-1">
                        Paket: {o.package_status ?? "—"} · ödeme: {o.package_payment_status ?? "—"} · ilk ders:{" "}
                        {o.first_session_status ?? "—"}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  {o.offer_status === "sent" && o.request_status === "open" && (
                    <button
                      type="button"
                      disabled={withdrawingId === o.offer_id}
                      onClick={() => void withdrawOffer(o.request_id, o.offer_id)}
                      className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-center text-sm font-medium text-paper-800 hover:bg-paper-50 disabled:opacity-50"
                    >
                      {withdrawingId === o.offer_id ? "…" : "Teklifi geri çek"}
                    </button>
                  )}
                  <Link
                    href={`/teacher/requests/${o.request_id}`}
                    className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-center text-sm font-medium text-paper-900 hover:bg-paper-50"
                  >
                    Mesajlar
                  </Link>
                  {o.offer_status === "accepted" && (
                    <Link
                      href="/teacher/dersler"
                      className="rounded-xl bg-brand-800 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-900"
                    >
                      Derslere git
                    </Link>
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
