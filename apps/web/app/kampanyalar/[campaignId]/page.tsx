"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthEntryLink } from "../../components/AuthEntryLink";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { trackEvent } from "../../lib/trackEvent";

type CampaignDetail = {
  id: string;
  title: string;
  description: string;
  delivery_mode: string;
  lesson_count: number | null;
  price_minor: number;
  currency: string;
  capacity: number | null;
  starts_at: string | null;
  branch_name: string | null;
  city_name: string | null;
  district_name: string | null;
  teacher_id: string;
  teacher_display_name: string;
  rating_avg: string | number | null;
  rating_count: number | null;
  verification_status: string;
  bio_raw: string | null;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function deliveryLabel(mode: string): string {
  if (mode === "online") return "Online";
  if (mode === "in_person") return "Yüz yüze";
  return "Hibrit";
}

function verificationLabel(status: string): string {
  if (status === "verified") return "Doğrulanmış öğretmen";
  if (status === "pending") return "Doğrulama incelemesinde";
  return "Profil doğrulaması bekliyor";
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : "";
  const [token, setToken] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(getToken());
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ campaign: CampaignDetail }>(`/v1/teacher-campaigns/${campaignId}`);
        if (!cancelled) setCampaign(r.campaign);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function apply() {
    if (!token) {
      router.push(loginHrefWithReturn(`/kampanyalar/${campaignId}`));
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/teacher-campaigns/${campaignId}/applications`, {
        method: "POST",
        token,
        body: JSON.stringify({ message: message.trim() || null }),
      });
      trackEvent("campaign_application_created", {
        entityType: "teacher_campaign",
        entityId: campaignId,
        metadata: { teacherId: campaign?.teacher_id, campaignTitle: campaign?.title },
      });
      setOk("Başvurunuz öğretmene iletildi. Öğretmen sizinle iletişime geçebilir.");
      setMessage("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "apply_failed";
      if (msg.includes("[401]")) {
        clearToken();
        setToken(null);
        router.replace(loginHrefWithReturn(`/kampanyalar/${campaignId}`));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Kampanyaya başvuru için öğrenci hesabıyla giriş yapmalısınız.");
      } else if (msg.includes("already_applied")) {
        setError("Bu kampanyaya daha önce başvuru bıraktınız.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <Link
            href="/kampanyalar"
            className="text-sm font-medium text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
          >
            ← Kampanyalar
          </Link>
          <AuthEntryLink path="/panel" className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-4">
            Panele git
          </AuthEntryLink>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}
        {ok ? (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">{ok}</div>
        ) : null}

        {!campaign ? (
          <div className="mt-8 text-sm text-paper-800/75">Yükleniyor…</div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_20rem]">
            <article className="rounded-xl border border-paper-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className="rounded-full bg-brand-50 px-2 py-1 text-brand-900">
                  {deliveryLabel(campaign.delivery_mode)}
                </span>
                <span className="rounded-full bg-paper-100 px-2 py-1 text-paper-800">
                  {campaign.branch_name ?? "Genel"}
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-paper-900">{campaign.title}</h1>
              <p className="mt-2 text-sm text-paper-800/70">
                {campaign.teacher_display_name} · {campaign.city_name ?? "Tüm Türkiye"}
                {campaign.district_name ? ` / ${campaign.district_name}` : ""}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-paper-100 bg-paper-50 p-3">
                  <div className="text-xs text-paper-800/55">Ders sayısı</div>
                  <div className="mt-1 text-lg font-semibold text-paper-900">{campaign.lesson_count ?? "Esnek"}</div>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
                  <div className="text-xs text-brand-900/65">Kampanya fiyatı</div>
                  <div className="mt-1 text-lg font-semibold text-brand-950">
                    {minorToTl(campaign.price_minor)} {campaign.currency}
                  </div>
                </div>
                <div className="rounded-xl border border-paper-100 bg-paper-50 p-3">
                  <div className="text-xs text-paper-800/55">Kontenjan</div>
                  <div className="mt-1 text-lg font-semibold text-paper-900">{campaign.capacity ?? "Esnek"}</div>
                </div>
              </div>

              {campaign.starts_at ? (
                <p className="mt-4 rounded-xl border border-warm-200 bg-warm-50 p-3 text-sm text-warm-950">
                  Başlangıç: {new Date(campaign.starts_at).toLocaleString("tr-TR")}
                </p>
              ) : null}

              <h2 className="mt-7 text-base font-semibold text-paper-900">Kampanya açıklaması</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper-800">{campaign.description}</p>
            </article>

            <aside className="space-y-4">
              <div className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-paper-900">Öğretmen güven özeti</div>
                <div className="mt-2 text-sm text-paper-800/75">{verificationLabel(campaign.verification_status)}</div>
                <div className="mt-1 text-xs text-paper-800/55">
                  Puan: {campaign.rating_avg ?? "Yeni"} {campaign.rating_count ? `(${campaign.rating_count} yorum)` : ""}
                </div>
                {campaign.bio_raw ? (
                  <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-paper-800/65">{campaign.bio_raw}</p>
                ) : null}
                <Link
                  href={`/ogretmenler/${campaign.teacher_id}`}
                  className="mt-4 inline-flex rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
                >
                  Öğretmen profilini aç
                </Link>
              </div>

              <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-paper-900">Bu kampanyayla ilgileniyorum</div>
                <p className="mt-2 text-xs leading-relaxed text-paper-800/65">
                  Başvuru bıraktığınızda adınız, e-posta adresiniz ve mesajınız öğretmene görünür. Kampanya ödemesi
                  platformdan alınmaz; detayları öğretmenle siz netleştirirsiniz.
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  className="mt-3 min-h-28 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="Örn. TYT matematik için 11. sınıf öğrencisiyim, program saatleri hakkında bilgi almak istiyorum."
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void apply()}
                  className="mt-3 w-full rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Gönderiliyor…" : token ? "Başvuru bırak" : "Giriş yap ve başvur"}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
