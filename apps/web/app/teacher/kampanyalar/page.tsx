"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { CampaignApplicationChat } from "../../components/CampaignApplicationChat";
import { TeacherFlowExplainer } from "../../components/TeacherFlowExplainer";

type CampaignRow = {
  id: string;
  title: string;
  description: string;
  status: "pending_review" | "published" | "paused" | "archived" | "rejected";
  delivery_mode: string;
  lesson_count: number | null;
  price_minor: number;
  currency: string;
  capacity: number | null;
  starts_at: string | null;
  listing_fee_minor: number;
  billing_model: "listing_fee" | "success_fee";
  success_fee_bps: number;
  free_listing_used: boolean;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  branch_name: string | null;
  city_name: string | null;
  application_count: number;
  new_application_count: number;
};

type ApplicationRow = {
  id: string;
  campaign_id: string;
  message: string | null;
  status: "new" | "contacted" | "closed";
  created_at: string;
  student_display_name: string;
  student_email: string | null;
  billing_model: "listing_fee" | "success_fee";
  message_count: number;
};

type UsagePack = {
  code: string;
  title: string;
  description: string;
  price_minor: number;
  currency: string;
};

type TeacherUsagePacks = {
  packs: UsagePack[];
  remainingConversationCredits: number;
  monthlyConversationQuota: {
    baseQuota: number;
    openedCount: number;
    remainingBase: number;
  };
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function deliveryLabel(mode: string): string {
  if (mode === "online") return "Online";
  if (mode === "in_person") return "Yüz yüze";
  return "Hibrit";
}

function statusLabel(status: string): string {
  if (status === "pending_review") return "İncelemede";
  if (status === "published") return "Yayında";
  if (status === "paused") return "Duraklatıldı";
  if (status === "rejected") return "Reddedildi";
  return "Arşiv";
}

function applicationStatusLabel(status: string): string {
  if (status === "new") return "Yeni";
  if (status === "contacted") return "İletişime geçildi";
  return "Kapandı";
}

function billingModelLabel(campaign: CampaignRow): string {
  if (campaign.billing_model === "success_fee") return `%${(campaign.success_fee_bps / 100).toFixed(0)} başarı bedelli`;
  if (Number(campaign.listing_fee_minor ?? 0) > 0) return `${minorToTl(campaign.listing_fee_minor)} TL sabit yayın ücreti`;
  return "Ücretsiz yayın hakkı";
}

export default function TeacherCampaignsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [listingFeeMinor, setListingFeeMinor] = useState(100_000);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applicationsByCampaign, setApplicationsByCampaign] = useState<Record<string, ApplicationRow[]>>({});
  const [usagePacks, setUsagePacks] = useState<TeacherUsagePacks | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    setError(null);
    const [r, packs] = await Promise.all([
      apiFetch<{ campaigns: CampaignRow[]; listingFeeMinor: number }>("/v1/teacher-campaigns/mine", {
        token: t,
      }),
      apiFetch<TeacherUsagePacks>("/v1/teacher-campaigns/usage-packs", { token: t }),
    ]);
    setRows(r.campaigns);
    setListingFeeMinor(r.listingFeeMinor);
    setUsagePacks(packs);
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      } else if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  const stats = useMemo(() => {
    const published = rows.filter((row) => row.status === "published").length;
    const applications = rows.reduce((sum, row) => sum + Number(row.application_count ?? 0), 0);
    const newApplications = rows.reduce((sum, row) => sum + Number(row.new_application_count ?? 0), 0);
    const paidListings = rows.filter((row) => Number(row.listing_fee_minor ?? 0) > 0).length;
    return { published, applications, newApplications, paidListings };
  }, [rows]);

  async function setStatus(campaignId: string, status: "pending_review" | "paused" | "archived") {
    if (!token) return;
    setBusyId(campaignId);
    setError(null);
    try {
      await apiFetch(`/v1/teacher-campaigns/${campaignId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "status_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function loadApplications(campaignId: string) {
    if (!token) return;
    setBusyId(campaignId);
    setError(null);
    try {
      const r = await apiFetch<{ applications: ApplicationRow[] }>(
        `/v1/teacher-campaigns/${campaignId}/applications`,
        { token },
      );
      setApplicationsByCampaign((prev) => ({ ...prev, [campaignId]: r.applications }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "applications_failed");
    } finally {
      setBusyId(null);
    }
  }

  async function setApplicationStatus(
    campaignId: string,
    applicationId: string,
    status: "new" | "contacted" | "closed",
  ) {
    if (!token) return;
    setBusyId(applicationId);
    setError(null);
    try {
      await apiFetch(`/v1/teacher-campaigns/${campaignId}/applications/${applicationId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await loadApplications(campaignId);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "application_status_failed");
    } finally {
      setBusyId(null);
    }
  }

  async function purchaseConversationPack(packCode: string) {
    if (!token) return;
    setBusyId(packCode);
    setError(null);
    try {
      await apiFetch(`/v1/teacher-campaigns/usage-packs/${packCode}/purchase`, {
        method: "POST",
        token,
      });
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "purchase_failed";
      setError(msg.includes("insufficient_balance") ? "Bu paket için cüzdan bakiyeniz yeterli değil." : msg);
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kampanyalarım</h1>
            <p className="mt-1 text-sm text-paper-800/75">
              Kendi reklam kampanyanızı oluşturun; öğrenciler başvuru bırakır, anlaşma sizinle öğrenci arasında ilerler.
            </p>
          </div>
          <Link
            href="/teacher/kampanyalar/yeni"
            className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Yeni kampanya
          </Link>
        </div>

        <div className="mt-4">
          <TeacherFlowExplainer variant="campaigns" />
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#f0fdfa_0%,#ffffff_55%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">İlan hakkı</div>
          <h2 className="mt-1 text-lg font-semibold text-paper-900">Sabit yayın ücreti veya başarı bedelli kampanya</h2>
          <p className="mt-1 max-w-3xl text-sm text-paper-800/70">
            Aktif öğretmen aboneliğiniz varsa sabit yayın ücretini seçebilir veya başarı bedelli modelle risksiz
            başlayabilirsiniz. Başarı bedelli modelde öğrenci ikinci derse devam edince %10 platform başarı bedeli
            net kazançtan ayrılır.
          </p>
          <div className="mt-4 grid gap-2 text-xs leading-relaxed text-paper-800/75 sm:grid-cols-3">
            <div className="rounded-xl border border-white/70 bg-white/80 p-3">
              Kampanya ilanı yönetici onayından sonra herkese açık vitrinde görünür.
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 p-3">
              Sabit modelde sonraki ilanlarda <span className="line-through text-paper-800/45">8.000 TL</span>{" "}
              yerine {minorToTl(listingFeeMinor)} TL cüzdan bakiyesi gerekir.
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 p-3">
              Komisyonlu kampanyalarda öğrenciyle güvenli sohbet bu panelde tutulur.
            </div>
          </div>
          {usagePacks ? (
            <div className="mt-4 rounded-2xl border border-brand-100 bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-paper-900">Komisyonlu kampanya görüşme hakkı</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
                    Bu ay {usagePacks.monthlyConversationQuota.openedCount}/{usagePacks.monthlyConversationQuota.baseQuota} yeni
                    öğrenci sohbeti açıldı. Ek paketlerden kalan hakkınız: {usagePacks.remainingConversationCredits}.
                  </p>
                </div>
                {usagePacks.packs.map((pack) => (
                  <button
                    key={pack.code}
                    type="button"
                    disabled={busyId === pack.code}
                    onClick={() => void purchaseConversationPack(pack.code)}
                    className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-left text-xs font-semibold text-brand-950 disabled:opacity-50"
                  >
                    <span className="block">{pack.title}</span>
                    <span className="block font-normal text-brand-900/70">
                      {minorToTl(pack.price_minor)} {pack.currency} · {pack.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
            <Link href="/teacher/cuzdan" className="rounded-full bg-white px-3 py-1.5 text-brand-900 ring-1 ring-brand-200">
              Cüzdanı yönet
            </Link>
            <Link href="/kampanyalar" className="rounded-full bg-white px-3 py-1.5 text-paper-900 ring-1 ring-paper-200">
              Herkese açık kampanya vitrini
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Yayında</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.published}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Yeni başvuru</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{stats.newApplications}</div>
          </div>
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Toplam başvuru</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{stats.applications}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Ücretli ilan</div>
            <div className="mt-1 text-2xl font-semibold text-warm-950">{stats.paidListings}</div>
          </div>
        </section>

        <div className="mt-8 space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75 shadow-sm">
              Henüz kampanya yok. “Yeni kampanya” ile ilk ücretsiz ilanınızı yayınlayın.
            </div>
          ) : (
            rows.map((campaign) => {
              const applications = applicationsByCampaign[campaign.id];
              return (
                <div key={campaign.id} className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-paper-900">{campaign.title}</div>
                      <div className="mt-1 text-xs text-paper-800/55">
                        {statusLabel(campaign.status)} · {deliveryLabel(campaign.delivery_mode)} ·{" "}
                        {campaign.branch_name ?? "Branş seçilmedi"} · {minorToTl(campaign.price_minor)} {campaign.currency}
                      </div>
                      <div className="mt-2 inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-900">
                        {billingModelLabel(campaign)}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-paper-800/70">{campaign.description}</p>
                      {campaign.status === "rejected" ? (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                          <div className="font-semibold">Ret nedeni</div>
                          <p className="mt-1 text-xs leading-relaxed">
                            {campaign.review_note?.trim() ||
                              "Kampanya onaylanmadı. Başlık, açıklama, fiyat veya vaatleri netleştirip yeniden incelemeye gönderin."}
                          </p>
                          {campaign.reviewed_at ? (
                            <p className="mt-1 text-[11px] text-red-900/65">
                              İnceleme zamanı: {new Date(campaign.reviewed_at).toLocaleString("tr-TR")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {campaign.status === "pending_review" ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                          Kampanya yönetici incelemesinde. Onaylanınca herkese açık vitrinde görünür; reddedilirse sebep burada gösterilir.
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium">
                        <span className="rounded-full bg-paper-100 px-2 py-0.5 text-paper-800">
                          {campaign.lesson_count ?? "Esnek"} ders
                        </span>
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-900">
                          {campaign.application_count} başvuru
                        </span>
                        <span className="rounded-full bg-warm-50 px-2 py-0.5 text-warm-900">
                          İlan ücreti: {campaign.listing_fee_minor > 0 ? `${minorToTl(campaign.listing_fee_minor)} TL` : "Ücretsiz"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        href={`/kampanyalar/${campaign.id}`}
                        className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
                      >
                        Herkese açık sayfa
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === campaign.id}
                        onClick={() => void loadApplications(campaign.id)}
                        className="rounded-xl bg-brand-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Başvurular
                      </button>
                      {campaign.status !== "published" && campaign.status !== "pending_review" ? (
                        <button
                          type="button"
                          disabled={busyId === campaign.id}
                          onClick={() => void setStatus(campaign.id, "pending_review")}
                          className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-950 disabled:opacity-50"
                        >
                          İncelemeye gönder
                        </button>
                      ) : campaign.status === "published" ? (
                        <button
                          type="button"
                          disabled={busyId === campaign.id}
                          onClick={() => void setStatus(campaign.id, "paused")}
                          className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-800 disabled:opacity-50"
                        >
                          Duraklat
                        </button>
                      ) : (
                        <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                          Yönetici incelemesinde
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busyId === campaign.id}
                        onClick={() => void setStatus(campaign.id, "archived")}
                        className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-800 disabled:opacity-50"
                      >
                        Arşivle
                      </button>
                    </div>
                  </div>

                  {applications ? (
                    <div className="mt-5 rounded-xl border border-paper-100 bg-paper-50 p-4">
                      <div className="text-sm font-semibold text-paper-900">Başvurular</div>
                      {applications.length === 0 ? (
                        <div className="mt-2 text-sm text-paper-800/65">Henüz başvuru yok.</div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {applications.map((application) => (
                            <div key={application.id} className="rounded-xl border border-paper-100 bg-white p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-medium text-paper-900">
                                    {application.student_display_name}
                                  </div>
                                  <div className="mt-0.5 text-xs text-paper-800/55">
                                    {application.student_email ?? "Platform içi sohbet"} · {applicationStatusLabel(application.status)} ·{" "}
                                    {new Date(application.created_at).toLocaleString("tr-TR")}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {application.billing_model === "success_fee" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenChatId((current) => (current === application.id ? null : application.id))
                                      }
                                      className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-950"
                                    >
                                      Sohbeti aç
                                    </button>
                                  ) : null}
                                  {(["new", "contacted", "closed"] as const).map((status) => (
                                    <button
                                      key={status}
                                      type="button"
                                      disabled={busyId === application.id || application.status === status}
                                      onClick={() => void setApplicationStatus(campaign.id, application.id, status)}
                                      className="rounded-lg border border-paper-200 bg-white px-2 py-1 text-xs font-medium text-paper-800 disabled:opacity-50"
                                    >
                                      {applicationStatusLabel(status)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {application.message ? (
                                <p className="mt-2 whitespace-pre-wrap text-sm text-paper-800/75">{application.message}</p>
                              ) : null}
                              {application.billing_model === "success_fee" && openChatId === application.id && token ? (
                                <CampaignApplicationChat
                                  token={token}
                                  campaignId={campaign.id}
                                  applicationId={application.id}
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
