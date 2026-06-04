"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type SubMe = {
  active: boolean;
  subscription: { id: string; expires_at: string; months_count: number } | null;
  pricePerMonthMinor: number;
};

type Wallet = { balanceMinor: number; currency: string };

type LedgerEntry = {
  id: string;
  delta_minor: string;
  balance_after: string;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
};

type InAppNotification = {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  payload_jsonb?: unknown;
};

type HoldsResponse = {
  holds?: Array<{
    id: string;
    amount_minor: string | number;
    currency: string;
    status: string;
    reason: string;
    ref_type: string | null;
    ref_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  activeHoldMinor: number;
};

type ProgressSnapshot = {
  snapshot_id: string;
  narrative_tr: string;
  metrics_jsonb: unknown;
  created_at: string;
  package_id: string;
  teacher_id: string;
  teacher_display_name: string;
  lesson_session_id: string;
  session_index: number;
};

type GuardianInvite = {
  id: string;
  code?: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_guardian_display_name: string | null;
  created_at: string;
};

function tl(minor: number): string {
  return (minor / 100).toFixed(2);
}

function tlMinor(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  return (n / 100).toFixed(2);
}

function StudentPanelPageInner() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const pathWithQuery = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);
  const [token, setToken] = useState<string | null>(null);
  const [sub, setSub] = useState<SubMe | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [activeHoldMinor, setActiveHoldMinor] = useState<number>(0);
  const [holds, setHolds] = useState<NonNullable<HoldsResponse["holds"]>>([]);
  const [months, setMonths] = useState(1);
  const [topupKurus, setTopupKurus] = useState(200000);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [progressSnapshots, setProgressSnapshots] = useState<ProgressSnapshot[]>([]);
  const [guardianInvites, setGuardianInvites] = useState<GuardianInvite[]>([]);
  const [guardianInviteBusy, setGuardianInviteBusy] = useState(false);
  const [notifBusyId, setNotifBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathWithQuery));
      return;
    }
    setToken(t);
  }, [router, pathWithQuery]);

  const load = useCallback(async (t: string) => {
    const [s, w, l, h, n, p, g] = await Promise.all([
      apiFetch<SubMe>("/v1/student-platform/subscription/me", { token: t }),
      apiFetch<Wallet>("/v1/wallet/me", { token: t }),
      apiFetch<{ entries: LedgerEntry[] }>("/v1/wallet/ledger?limit=25", { token: t }),
      apiFetch<HoldsResponse>("/v1/wallet/holds?limit=50", { token: t }),
      apiFetch<{ notifications: InAppNotification[] }>("/v1/notifications?limit=8", { token: t }).catch(
        () => ({ notifications: [] as InAppNotification[] }),
      ),
      apiFetch<{ snapshots: ProgressSnapshot[] }>("/v1/lesson-sessions/progress/mine", { token: t }).catch(
        () => ({ snapshots: [] as ProgressSnapshot[] }),
      ),
      apiFetch<{ invites: GuardianInvite[] }>("/v1/guardians/invites/mine", { token: t }).catch(
        () => ({ invites: [] as GuardianInvite[] }),
      ),
    ]);
    setSub(s);
    setWallet(w);
    setLedger(l.entries);
    setActiveHoldMinor(h.activeHoldMinor ?? 0);
    setHolds(h.holds ?? []);
    setNotifications(n.notifications);
    setProgressSnapshots(p.snapshots);
    setGuardianInvites(g.invites);
  }, []);

  async function createGuardianInvite() {
    if (!token) return;
    setGuardianInviteBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await apiFetch<{ invite: GuardianInvite }>("/v1/guardians/invites", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      setGuardianInvites((prev) => [r.invite, ...prev].slice(0, 10));
      setOk(`Veli davet kodu oluşturuldu: ${r.invite.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "guardian_invite_failed");
    } finally {
      setGuardianInviteBusy(false);
    }
  }

  async function markNotificationRead(id: string) {
    if (!token) return;
    setNotifBusyId(id);
    try {
      await apiFetch(`/v1/notifications/${id}/read`, { method: "PATCH", token });
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x,
        ),
      );
    } catch {
      /* yoksay */
    } finally {
      setNotifBusyId(null);
    }
  }

  function notificationHref(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const o = payload as {
      kind?: string;
      homeworkPostId?: string;
      lessonSessionId?: string;
      courseSessionId?: string;
      classroomHref?: string;
      requestId?: string;
      groupLessonId?: string;
      directBookingId?: string;
    };
    if (typeof o.classroomHref === "string" && o.classroomHref.startsWith("/classroom/")) {
      return o.classroomHref;
    }
    const isHomeworkKind =
      o.kind === "homework_claimed" ||
      o.kind === "homework_answered" ||
      o.kind === "homework_rewarded_student" ||
      o.kind === "homework_teacher_returned";
    if (o.homeworkPostId && isHomeworkKind) {
      return `/student/odev-sor/${o.homeworkPostId}`;
    }
    if (o.kind === "lesson_scheduled" || o.kind === "lesson_completed" || o.lessonSessionId) {
      return "/student/dersler";
    }
    if (
      o.kind === "course_session_scheduled" ||
      o.kind === "course_session_reminder_24h" ||
      o.kind === "course_session_reminder_2h" ||
      o.courseSessionId
    ) {
      return "/student/kurslar";
    }
    if (
      (o.kind === "lesson_offer_received" || o.kind === "lesson_demo_offer_received") &&
      typeof o.requestId === "string"
    ) {
      return `/student/requests/${o.requestId}`;
    }
    if (
      o.kind === "group_lesson_teacher_assigned" ||
      o.kind === "group_lesson_joined" ||
      o.kind === "group_lesson_completed" ||
      o.groupLessonId
    ) {
      return "/student/grup-dersler";
    }
    if (o.kind === "direct_booking_completed" || o.directBookingId) {
      return "/student/dogrudan-dersler";
    }
    return null;
  }

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathWithQuery));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğrenci hesabı içindir.");
      }
    });
  }, [token, load, router, pathWithQuery]);

  async function topupWallet() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (topupKurus < 10_000) throw new Error("En az 100,00 TL");
      const r = await apiFetch<{ next: { checkout: string } }>("/v1/wallet/topup", {
        method: "POST",
        token,
        body: JSON.stringify({ amountMinor: topupKurus }),
      });
      const ck = await apiFetch<{ iframeUrl: string }>(r.next.checkout, { token });
      window.open(ck.iframeUrl, "_blank", "noopener,noreferrer");
      setOk("Cüzdan yükleme açıldı. Sonra sayfayı yenileyin.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "topup_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathWithQuery));
      }
      if (msg.includes("[403]")) {
        setError("Cüzdan yüklemek için öğrenci hesabı gerekir.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function buySub() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await apiFetch<{ next: { checkout: string } }>("/v1/student-platform/subscription/purchase", {
        method: "POST",
        token,
        body: JSON.stringify({ months }),
      });
      const ck = await apiFetch<{ iframeUrl: string }>(r.next.checkout, { token });
      window.open(ck.iframeUrl, "_blank", "noopener,noreferrer");
      setOk("Ödeme penceresi açıldı. Bitince sayfayı yenileyin.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "purchase_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathWithQuery));
      }
      if (msg.includes("[403]")) {
        setError("Abonelik satın almak için öğrenci hesabı gerekir.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  const showOnboarding = searchParams.get("onboarding") === "1";
  const nextBestAction = !sub?.active
    ? {
        title: "Platform aboneliğini başlat",
        body: "Öğretmen talebi, soru havuzu ve takip akışlarını açmak için öğrenci aboneliğini tamamlayın.",
        href: "#platform-aboneligi",
        cta: "Aboneliğe git",
      }
    : wallet && wallet.balanceMinor - activeHoldMinor < 50_000
      ? {
          title: "Cüzdanı hazırla",
          body: "Demo, paket veya doğrudan ders ödemesinde takılmamak için kullanılabilir bakiyeyi kontrol edin.",
          href: "#bakiye",
          cta: "Bakiye yükle",
        }
      : progressSnapshots.length === 0
        ? {
            title: "İlk çalışma izini oluştur",
            body: "Bir soru gönderin veya çalışma planı açın; paneliniz ilerleme önerilerini buradan üretir.",
            href: "/student/odev-sor",
            cta: "Soru gönder",
          }
        : {
            title: "Ders ve planı takip et",
            body: "Son ders değerlendirmelerini ve haftalık planı kontrol edip sıradaki konuyu işaretleyin.",
            href: "/student/calisma",
            cta: "Plana git",
          };

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Özet</h1>
        <p className="mt-1 text-sm text-paper-800/80">
          Abonelik, cüzdan ve bildirimler. Güncel paket tutarı:{" "}
          <span className="font-medium text-paper-900">{sub ? `${tl(sub.pricePerMonthMinor)} TL/ay` : "—"}</span>.
        </p>
        <p className="mt-3 text-sm text-paper-800/70">
          Dersler ve kurslar üst menüde; en sık işlem talep açmak.
        </p>
        <div className="mt-4">
          <Link
            href="/student/requests"
            className="inline-flex rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
          >
            Taleplerim
          </Link>
          <p className="mt-3 text-sm text-paper-800/70">
            <Link
              href="/student/odev-sor"
              className="font-medium text-brand-800 underline decoration-brand-400 underline-offset-2"
            >
              Ödev / soru gönder
            </Link>
            <span className="text-paper-800/40"> · </span>
            <Link
              href="/student/odev-sor/gonderiler"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-2 hover:text-paper-900"
            >
              Gönderilerim
            </Link>
            <span className="text-paper-800/40"> · </span>
            <Link href="/student/calisma" className="text-paper-800/75 underline decoration-paper-300 underline-offset-2 hover:text-paper-900">
              Çalışma planı
            </Link>
            <span className="text-paper-800/40"> · </span>
            <Link href="/courses" className="text-paper-800/75 underline decoration-paper-300 underline-offset-2 hover:text-paper-900">
              Kurs kataloğu
            </Link>
            <span className="text-paper-800/40"> · </span>
            <Link href="/ogretmenler" className="text-paper-800/75 underline decoration-paper-300 underline-offset-2 hover:text-paper-900">
              Öğretmen ara
            </Link>
          </p>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { href: "/student/odev-sor", title: "Soru gönder", body: "Fotoğraf çek, aciliyet seç, çözümü takip et." },
            { href: "/student/calisma", title: "Planı işaretle", body: "Haftalık görevleri tamamlandı/atlandı yap." },
            { href: "/student/dersler", title: "Canlı dersler", body: "Yaklaşan ders ve sınıf linklerine hızlı gir." },
            { href: "/ogretmenler?verifiedOnly=1&sort=recommended", title: "Öğretmen bul", body: "Doğrulanmış profilleri karşılaştır." },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-paper-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30"
            >
              <div className="text-sm font-semibold text-paper-900">{item.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-800/70">
                {showOnboarding ? "İlk kurulum" : "Sonraki en iyi işlem"}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-paper-900">{nextBestAction.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">{nextBestAction.body}</p>
            </div>
            <Link
              href={nextBestAction.href}
              className="shrink-0 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
            >
              {nextBestAction.cta}
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-paper-900">Veli davet kodu</h2>
              <p className="mt-1 text-sm text-paper-800/65">
                Veliniz bu kodu veli paneline girerek hesabınıza bağlanır. Kod 7 gün geçerlidir ve tek kullanımlıktır.
              </p>
            </div>
            <button
              type="button"
              disabled={guardianInviteBusy}
              onClick={() => void createGuardianInvite()}
              className="shrink-0 rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50 disabled:opacity-50"
            >
              {guardianInviteBusy ? "…" : "Kod oluştur"}
            </button>
          </div>
          {guardianInvites.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {guardianInvites.slice(0, 3).map((invite) => (
                <li key={invite.id} className="rounded-xl border border-paper-100 bg-paper-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-paper-900">{invite.code ?? invite.id.slice(0, 8)}</span>
                    <span className="text-xs text-paper-800/55">
                      {invite.accepted_at
                        ? `Kullanıldı${invite.accepted_guardian_display_name ? ` · ${invite.accepted_guardian_display_name}` : ""}`
                        : `Son: ${new Date(invite.expires_at).toLocaleString("tr-TR")}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            {ok}
          </div>
        )}

        {progressSnapshots.length > 0 && (
          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Gelişim özeti</h2>
            <p className="mt-1 text-xs text-paper-800/55">
              Öğretmenlerin ders sonunda girdiği kısa değerlendirmeler ve sonraki adımlar.
            </p>
            <ul className="mt-4 space-y-3">
              {progressSnapshots.slice(0, 3).map((s) => (
                <li key={s.snapshot_id} className="rounded-xl border border-paper-100 bg-paper-50 px-3 py-2 text-sm">
                  <div className="font-medium text-paper-900">
                    {s.teacher_display_name} · ders #{s.session_index}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-paper-800">{s.narrative_tr}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-paper-800/55">
                    <span>{new Date(s.created_at).toLocaleString("tr-TR")}</span>
                    <Link href="/student/dersler" className="font-medium text-brand-800 underline">
                      Derslere git
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Bildirimler</h2>
            <p className="mt-1 text-xs text-paper-800/55">Ödev ve hesap güncellemeleri.</p>
            <ul className="mt-4 space-y-3">
              {notifications.map((n) => {
                const unread = n.read_at == null;
                const href = notificationHref(n.payload_jsonb);
                return (
                  <li
                    key={n.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      unread ? "border-brand-200 bg-brand-50/60" : "border-paper-100 bg-paper-50"
                    }`}
                  >
                    <div className="font-medium text-paper-900">{n.title}</div>
                    <p className="mt-1 text-paper-800">{n.body}</p>
                    {href ? (
                      <Link href={href} className="mt-2 inline-block text-xs font-medium text-brand-800 underline">
                        Detaya git
                      </Link>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-paper-800/55">
                      <span>
                        {n.sent_at ? new Date(n.sent_at).toLocaleString("tr-TR") : "—"}
                      </span>
                      {unread && (
                        <button
                          type="button"
                          disabled={notifBusyId === n.id}
                          onClick={() => void markNotificationRead(n.id)}
                          className="rounded-lg border border-paper-300 bg-white px-2 py-1 text-xs font-medium text-paper-800 hover:bg-paper-100 disabled:opacity-50"
                        >
                          {notifBusyId === n.id ? "…" : "Okundu"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div id="bakiye" className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Bakiye</h2>
          {wallet && (
            <p className="mt-1 text-2xl font-mono text-paper-800">
              {tl(wallet.balanceMinor)} {wallet.currency}
            </p>
          )}
          <p className="mt-1 text-xs text-paper-800/55">
            Bloke:{" "}
            <span className="font-mono font-medium text-paper-800">
              {tl(activeHoldMinor)} TL
            </span>
            {wallet ? (
              <>
                {" · "}
                Kullanılabilir:{" "}
                <span className="font-mono font-medium text-paper-800">
                  {tl(Math.max(0, wallet.balanceMinor - activeHoldMinor))} TL
                </span>
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="text-paper-800/75">Tutar (kuruş, en az 10.000)</span>
              <input
                type="number"
                min={10000}
                step={1000}
                value={topupKurus}
                onChange={(e) => setTopupKurus(Number(e.target.value) || 10000)}
                className="ml-0 mt-1 block w-full max-w-xs rounded-lg border border-paper-200 px-2 py-1 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void topupWallet()}
              className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-900 disabled:opacity-50"
            >
              Cüzdanı PayTR ile yükle
            </button>
          </div>
        </div>

        <div id="platform-aboneligi" className="mt-4 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Blokajlar</h2>
          <p className="mt-1 text-xs text-paper-800/55">
            Grup ders vb. için tutar bloke olabilir; ders bitene kadar sürebilir.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-paper-100">
            {holds.length === 0 ? (
              <p className="p-3 text-sm text-paper-800/55">Blokaj yok.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-paper-100 bg-paper-50 text-paper-800/55">
                  <tr>
                    <th className="px-2 py-2">Tarih</th>
                    <th className="px-2 py-2">Durum</th>
                    <th className="px-2 py-2">Sebep</th>
                    <th className="px-2 py-2">Ref</th>
                    <th className="px-2 py-2 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.slice(0, 50).map((h) => (
                    <tr key={h.id} className="border-b border-paper-100">
                      <td className="px-2 py-2 font-mono text-paper-800/75">
                        {new Date(h.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2 py-2 text-paper-800">{h.status}</td>
                      <td className="px-2 py-2 text-paper-800">{h.reason}</td>
                      <td className="px-2 py-2 font-mono text-paper-800/75">
                        {(h.ref_type ?? "—") + (h.ref_id ? `:${h.ref_id.slice(0, 8)}` : "")}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-paper-800">
                        {tlMinor(h.amount_minor)} {h.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Son cüzdan hareketleri</h2>
          <p className="mt-1 text-xs text-paper-800/55">
            Yükleme, doğrudan ders bloke ödemesi vb. Son 25 kayıt.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-paper-100">
            {ledger.length === 0 ? (
              <p className="p-3 text-sm text-paper-800/55">Henüz hareket yok.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="border-b border-paper-100 bg-paper-50 text-paper-800/55">
                  <tr>
                    <th className="px-2 py-2">Tarih</th>
                    <th className="px-2 py-2">Tür</th>
                    <th className="px-2 py-2 text-right">Değişim</th>
                    <th className="px-2 py-2 text-right">Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-b border-paper-100">
                      <td className="px-2 py-2 font-mono text-paper-800/75">
                        {new Date(e.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2 py-2 text-paper-800">{e.kind}</td>
                      <td className="px-2 py-2 text-right font-mono text-paper-800">
                        {Number(e.delta_minor) >= 0 ? "+" : ""}
                        {tlMinor(e.delta_minor)} TL
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-paper-800/75">
                        {tlMinor(e.balance_after)} TL
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Platform aboneliği</h2>
          {sub?.active && sub.subscription ? (
            <p className="mt-2 text-sm text-paper-800">
              Aktif. Bitiş:{" "}
              <span className="font-mono text-paper-800">
                {new Date(sub.subscription.expires_at).toLocaleString("tr-TR")}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-800">Aboneliğiniz yok veya süresi dolmuş.</p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-paper-800/75">Ay sayısı</span>
              <input
                type="number"
                min={1}
                max={60}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) || 1)}
                className="ml-2 w-20 rounded-lg border border-paper-200 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void buySub()}
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              PayTR ile satın al
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentPanelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper-50">
          <div className="mx-auto max-w-2xl px-6 py-10 text-sm text-paper-800/75">Yükleniyor…</div>
        </div>
      }
    >
      <StudentPanelPageInner />
    </Suspense>
  );
}
