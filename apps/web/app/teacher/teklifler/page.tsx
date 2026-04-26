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
  city_id: number | null;
  delivery_mode: string;
  request_note_preview: string | null;
  request_created_at: string;
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

  return (
    <div className="min-h-screen bg-zinc-50">
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-500">Öğretmen</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Verdiğim teklifler
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Talep durumu ve teklif sonucunu buradan takip edin; mesajlaşma için
            talebe gidin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/teacher/requests"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Açık talepler
          </Link>
          <Link
            href="/teacher/odev-havuzu"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
          >
            Ödev havuzu
          </Link>
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
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    Talep #{o.request_id.slice(0, 8)} · {o.branch_name ?? `Branş ${o.branch_id}`}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Talep: {statusTr(o.request_status)} · Teklif:{" "}
                    {statusTr(o.offer_status)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {o.delivery_mode} · {new Date(o.offer_created_at).toLocaleString("tr-TR")}
                  </div>
                  {o.request_note_preview && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                      {o.request_note_preview}
                    </p>
                  )}
                  {o.proposed_hourly_rate_minor != null && (
                    <div className="mt-2 text-xs text-zinc-600">
                      Önerilen saatlik: {minorToTl(o.proposed_hourly_rate_minor)} TL
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  {o.offer_status === "sent" && o.request_status === "open" && (
                    <button
                      type="button"
                      disabled={withdrawingId === o.offer_id}
                      onClick={() => void withdrawOffer(o.request_id, o.offer_id)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {withdrawingId === o.offer_id ? "…" : "Teklifi geri çek"}
                    </button>
                  )}
                  <Link
                    href={`/teacher/requests/${o.request_id}`}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    Mesajlar
                  </Link>
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
