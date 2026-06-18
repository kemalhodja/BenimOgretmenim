"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { trackEvent } from "../../lib/trackEvent";

type SubMe = {
  active: boolean;
  subscription: { id: string; expires_at: string; months_count: number } | null;
  pricePerMonthMinor: number;
  annualMonths: number;
  annualPriceMinor: number;
  policy: {
    tier: "free" | "annual";
    dailyLessonRequestLimit: number;
    dailyHomeworkPostLimit: number;
  };
  usage: {
    lessonRequestsToday: number;
    homeworkPostsToday: number;
    lessonRequestsRemaining: number;
    homeworkPostsRemaining: number;
    extraLessonRequestCredits: number;
    extraHomeworkCredits: number;
  } | null;
};

type Wallet = { balanceMinor: number; currency: string };

type UsagePack = {
  code: string;
  title: string;
  description: string;
  price_minor: number;
  currency: string;
};

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

function holdStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Güvencede",
    released: "Serbest bırakıldı",
    captured: "Tahsil edildi",
    refunded: "İade edildi",
    cancelled: "İptal edildi",
  };
  return labels[status] ?? "Durum güncellendi";
}

function holdReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    group_lesson_join: "Grup dersi katılımı",
    direct_booking: "Doğrudan ders",
    course_enrollment: "Kurs kaydı",
    lesson_package: "Ders paketi",
  };
  return labels[reason] ?? "Ödeme güvencesi";
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
  const [months] = useState(12);
  const [topupKurus, setTopupKurus] = useState(200000);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [progressSnapshots, setProgressSnapshots] = useState<ProgressSnapshot[]>([]);
  const [guardianInvites, setGuardianInvites] = useState<GuardianInvite[]>([]);
  const [usagePacks, setUsagePacks] = useState<UsagePack[]>([]);
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
    const [s, w, l, h, n, p, g, packs] = await Promise.all([
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
      apiFetch<{ packs: UsagePack[] }>("/v1/student-platform/usage-packs", { token: t }).catch(
        () => ({ packs: [] as UsagePack[] }),
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
    setUsagePacks(packs.packs);
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

  function notificationKindLabel(payload: unknown): string {
    if (!payload || typeof payload !== "object") return "Genel";
    const kind = String((payload as { kind?: unknown }).kind ?? "");
    if (kind.includes("homework")) return "Ödev";
    if (kind.includes("lesson")) return "Ders";
    if (kind.includes("course")) return "Kurs";
    if (kind.includes("group")) return "Grup ders";
    if (kind.includes("direct")) return "Doğrudan ders";
    return "Genel";
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
      trackEvent("payment_checkout_start", { metadata: { flow: "wallet_topup", amountMinor: topupKurus } });
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
      trackEvent("student_subscription_purchase_start", { metadata: { months } });
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

  async function buyUsagePack(packCode: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/student-platform/usage-packs/${packCode}/purchase`, {
        method: "POST",
        token,
      });
      setOk("Ek hak paketi cüzdan bakiyenizden alındı.");
      await load(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "usage_pack_purchase_failed";
      setError(msg.includes("insufficient_balance") ? "Bu ek paket için cüzdan bakiyeniz yeterli değil." : msg);
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  const showOnboarding = searchParams.get("onboarding") === "1";
  const nextBestAction = !sub?.active
    ? {
        title: "Ücretsiz kotayı kullan veya yıllık abonelikle yükselt",
        body: "Yıllık abonelik daha çok öğretmene ulaşmanızı ve takıldığınız soruları daha hızlı çözmenizi sağlar: günlük 5 ilan ve 10 soru.",
        href: "#platform-aboneligi",
        cta: "Kotaları gör",
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
  const unreadNotifications = notifications.filter((n) => n.read_at == null).length;
  const latestNotification = notifications[0] ?? null;
  const latestNotificationHref = latestNotification ? notificationHref(latestNotification.payload_jsonb) : null;
  const completedLessonSignals = new Set(progressSnapshots.map((snapshot) => snapshot.lesson_session_id)).size;
  const weeklyTargetSignals = progressSnapshots.length;
  const latestProgressSnapshot = progressSnapshots[0] ?? null;
  const weakTopicHint =
    latestProgressSnapshot?.narrative_tr
      ?.split(/[.!?\n]/)
      .map((part) => part.trim())
      .find((part) => /zayıf|eksik|tekrar|çalış/i.test(part)) ?? "Zayıf konu için son ders notu veya soru çözümü bekleniyor.";
  const nextStepHint =
    latestProgressSnapshot?.narrative_tr
      ?.split(/[.!?\n]/)
      .map((part) => part.trim())
      .find((part) => /sonraki|ödev|hedef|plan/i.test(part)) ?? "Bugün bir soru gönderin veya çalışma planını güncelleyin.";
  const homeworkUsageText = sub?.usage
    ? `${sub.usage.homeworkPostsToday}/${sub.policy.dailyHomeworkPostLimit}`
    : "—";
  const lessonRequestUsageText = sub?.usage
    ? `${sub.usage.lessonRequestsToday}/${sub.policy.dailyLessonRequestLimit}`
    : "—";

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Özet</h1>
        <p className="mt-1 text-sm text-paper-800/80">
          Abonelik, cüzdan ve bildirimler. Yıllık öğrenci aboneliği:{" "}
          <span className="font-medium text-paper-900">
            {sub ? `${tl(sub.annualPriceMinor)} TL / ${sub.annualMonths} ay` : "—"}
          </span>.
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

        <section className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-paper-800/55">
                Bugün ne yapmalıyım?
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">Öğrenci için 3 adımlı hızlı plan</h2>
              <p className="mt-1 text-sm leading-relaxed text-paper-800/65">
                Öğretmen seçimi, soru çözümü ve çalışma takibi arasında kaybolmadan sıradaki adımı tamamlayın.
              </p>
            </div>
            <Link href="/ogretmenler" className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900">
              Öğretmen sihirbazı
            </Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {[
              {
                label: "1. Hedefi netleştir",
                body: weeklyTargetSignals > 0 ? "Haftalık planınız hazır; sıradaki zayıf konuya odaklanın." : "Çalışma planı açıp sınav/hedef bilgisiyle ilk haftayı oluşturun.",
                href: "/student/calisma",
                cta: "Planı aç",
              },
              {
                label: "2. Takıldığın soruyu gönder",
                body: homeworkUsageText === "—" ? "Soru hakkı bilgisi yüklenince günlük hakkınızı takip edin." : `Bugünkü soru hakkı: ${homeworkUsageText}.`,
                href: "/student/odev-sor",
                cta: "Soru gönder",
              },
              {
                label: "3. Öğretmen adaylarını karşılaştır",
                body: "Doğrulanmış profil, ücret, yorum ve kalite bilgilerini kısa listede karşılaştırın.",
                href: "/ogretmenler?verifiedOnly=1&sort=recommended",
                cta: "Öğretmen ara",
              },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="rounded-xl border border-paper-200 bg-paper-50 p-4 hover:border-brand-200 hover:bg-brand-50/40">
                <div className="text-sm font-semibold text-paper-950">{item.label}</div>
                <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{item.body}</p>
                <span className="mt-3 inline-flex text-xs font-semibold text-brand-800 underline">{item.cta}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-800/70">
                Başarı paneli
              </div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">
                Ders, soru ve veli takibini tek bakışta ölçün
              </h2>
            </div>
            <Link href="/student/calisma" className="text-sm font-semibold text-brand-800 underline">
              Çalışma detayları
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-brand-50 p-3">
              <div className="text-2xl font-semibold text-brand-950">{completedLessonSignals}</div>
              <div className="text-xs text-brand-900/70">Ders değerlendirme izi</div>
            </div>
            <div className="rounded-xl bg-paper-50 p-3">
              <div className="text-2xl font-semibold text-paper-950">{weeklyTargetSignals}</div>
              <div className="text-xs text-paper-800/65">Gelişim özeti</div>
            </div>
            <div className="rounded-xl bg-paper-50 p-3">
              <div className="text-2xl font-semibold text-paper-950">{homeworkUsageText}</div>
              <div className="text-xs text-paper-800/65">Bugünkü soru hakkı</div>
            </div>
            <div className="rounded-xl bg-warm-50 p-3">
              <div className="text-2xl font-semibold text-warm-950">{lessonRequestUsageText}</div>
              <div className="text-xs text-warm-900/70">Bugünkü talep hakkı</div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-paper-800/60">
            Veli bağlantısı kurulduğunda bu bilgiler ders katılımı, ödev durumu ve öğretmen notlarıyla birlikte
            takip edilebilir.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Haftalık plan</div>
              <div className="mt-1 text-sm font-semibold text-paper-950">
                {weeklyTargetSignals > 0 ? `${weeklyTargetSignals} gelişim kaydı oluştu` : "İlk plan kaydı bekleniyor"}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{nextStepHint}</p>
            </div>
            <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Öğretmen notu</div>
              <div className="mt-1 text-sm font-semibold text-paper-950">
                {latestProgressSnapshot
                  ? `${latestProgressSnapshot.teacher_display_name} · ders #${latestProgressSnapshot.session_index}`
                  : "Henüz ders notu yok"}
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-paper-800/65">
                {latestProgressSnapshot?.narrative_tr ?? "Ders tamamlandığında öğretmen notu burada özetlenecek."}
              </p>
            </div>
            <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">Geliştirilecek konu ve sıradaki adım</div>
              <div className="mt-1 text-sm font-semibold text-paper-950">Sıradaki odak</div>
              <p className="mt-2 text-xs leading-relaxed text-paper-800/65">{weakTopicHint}</p>
              <Link href="/student/odev-sor" className="mt-3 inline-flex text-xs font-semibold text-brand-800 underline">
                Bu konudan soru gönder
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { href: "/student/odev-sor", title: "Soru gönder", body: "Fotoğraf çek, aciliyet seç, çözümü takip et." },
            { href: "/student/calisma", title: "Planı işaretle", body: "Haftalık görevleri tamamlandı/atlandı yap." },
            { href: "/student/dersler", title: "Canlı dersler", body: "Yaklaşan derslerin sınıf bağlantılarına hızlı gir." },
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

        <section className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-paper-800/55">
                Olay zaman çizelgesi
              </div>
              <h2 className="mt-1 text-base font-semibold text-paper-900">
                {unreadNotifications > 0
                  ? `${unreadNotifications} okunmamış gelişme var`
                  : latestNotification
                    ? "Son gelişme kayıt altında"
                    : "Henüz yeni gelişme yok"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-800/70">
                Ders, ödev, kurs ve ödeme dışı takip olayları burada tek sırada görünür.
              </p>
            </div>
            {latestNotificationHref ? (
              <Link
                href={latestNotificationHref}
                className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100"
              >
                Son detaya git
              </Link>
            ) : null}
            <Link
              href="/bildirimler"
              className="w-fit rounded-xl border border-paper-200 bg-white px-3 py-2 text-xs font-semibold text-paper-900 hover:bg-paper-50"
            >
              Tüm bildirimler
            </Link>
          </div>
          {latestNotification ? (
            <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-paper-800 ring-1 ring-paper-200">
                  {notificationKindLabel(latestNotification.payload_jsonb)}
                </span>
                <span className="text-xs text-paper-800/55">
                  {latestNotification.sent_at ? new Date(latestNotification.sent_at).toLocaleString("tr-TR") : "Zaman yok"}
                </span>
              </div>
              <div className="mt-2 font-semibold text-paper-900">{latestNotification.title}</div>
              <p className="mt-1 line-clamp-2 text-paper-800/70">{latestNotification.body}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-3 text-sm text-paper-800/65">
              İlk ders, ödev veya teklif gelişmesi oluştuğunda burada özetlenecek.
            </p>
          )}
        </section>

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
            Güvencede:{" "}
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
          <h2 className="text-sm font-semibold text-paper-900">Güvenceye alınan tutarlar</h2>
          <p className="mt-1 text-xs text-paper-800/55">
            Grup ders vb. için tutar cüzdanda tutulabilir; ders bitene kadar sürebilir.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-paper-100">
            {holds.length === 0 ? (
              <p className="p-3 text-sm text-paper-800/55">Güvenceye alınan tutar yok.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-paper-100 bg-paper-50 text-paper-800/55">
                  <tr>
                    <th className="px-2 py-2">Tarih</th>
                    <th className="px-2 py-2">Durum</th>
                    <th className="px-2 py-2">Sebep</th>
                    <th className="px-2 py-2">Kayıt</th>
                    <th className="px-2 py-2 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.slice(0, 50).map((h) => (
                    <tr key={h.id} className="border-b border-paper-100">
                      <td className="px-2 py-2 font-mono text-paper-800/75">
                        {new Date(h.created_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2 py-2 text-paper-800">{holdStatusLabel(h.status)}</td>
                      <td className="px-2 py-2 text-paper-800">{holdReasonLabel(h.reason)}</td>
                      <td className="px-2 py-2 font-mono text-paper-800/75">
                        {h.ref_type ? "İlgili ders/kayıt" : "Genel cüzdan kaydı"}
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
            Yükleme, doğrudan ders ödemesi vb. Son 25 kayıt.
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
          <p className="mt-2 text-sm leading-relaxed text-paper-800/70">
            Abonelik; daha çok öğretmenle deneme yapmanız, daha çok soru göndermeniz ve ders sürecini tek panelde
            düzenli takip etmeniz için tasarlandı.
          </p>
          {sub?.active && sub.subscription ? (
            <p className="mt-2 text-sm text-paper-800">
              Aktif. Bitiş:{" "}
              <span className="font-mono text-paper-800">
                {new Date(sub.subscription.expires_at).toLocaleString("tr-TR")}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-800">
              Yıllık aboneliğiniz yok. Ücretsiz günlük kotayla kullanmaya devam edebilirsiniz.
            </p>
          )}
          {sub ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-paper-100 bg-paper-50 p-3">
                <div className="text-xs font-semibold text-paper-800/60">Ücretsiz öğrenci</div>
                <p className="mt-1 text-sm text-paper-900">Günlük 1 ders ilanı, günlük 5 soru hakkı.</p>
                <p className="mt-2 text-xs leading-relaxed text-paper-800/60">
                  Temel kullanım için yeterli; ancak birden fazla öğretmen denemek veya yoğun soru çözmek için sınırlıdır.
                </p>
              </div>
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                <div className="text-xs font-semibold text-brand-900/70">Yıllık abone</div>
                <p className="mt-1 text-sm text-brand-950">
                  {tl(sub.annualPriceMinor)} TL / {sub.annualMonths} ay: günlük 5 ders ilanı, günlük 10 soru hakkı.
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-brand-900">
                  <li>• Daha fazla öğretmenden teklif alma</li>
                  <li>• Ödev ve sınav hazırlığında daha çok soru hakkı</li>
                  <li>• Demo, teklif, ödeme ve çalışma takibini tek panelde toplama</li>
                </ul>
              </div>
            </div>
          ) : null}
          {sub?.usage ? (
            <div className="mt-3 rounded-xl border border-paper-100 bg-white p-3 text-xs text-paper-800/75">
              Bugünkü kalan hak: {sub.usage.lessonRequestsRemaining}/{sub.policy.dailyLessonRequestLimit} ders ilanı,{" "}
              {sub.usage.homeworkPostsRemaining}/{sub.policy.dailyHomeworkPostLimit} soru. Mevcut paket:{" "}
              {sub.policy.tier === "annual" ? "Yıllık abone" : "Ücretsiz"}.
              {(sub.usage.extraLessonRequestCredits > 0 || sub.usage.extraHomeworkCredits > 0) ? (
                <span>
                  {" "}
                  Ek hak: {sub.usage.extraLessonRequestCredits} ders talebi, {sub.usage.extraHomeworkCredits} soru.
                </span>
              ) : null}
            </div>
          ) : null}
          {usagePacks.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
              <div className="text-sm font-semibold text-paper-900">Ek hak satın al</div>
              <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
                Günlük hakkınız dolduğunda aynı gün kullanmak için ek ders talebi veya soru hakkı alabilirsiniz.
                Ödeme cüzdan bakiyenizden düşer.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {usagePacks.map((pack) => (
                  <button
                    key={pack.code}
                    type="button"
                    disabled={busy}
                    onClick={() => void buyUsagePack(pack.code)}
                    className="rounded-xl border border-brand-200 bg-white p-3 text-left text-xs shadow-sm disabled:opacity-50"
                  >
                    <span className="block font-semibold text-paper-950">{pack.title}</span>
                    <span className="mt-1 block leading-relaxed text-paper-800/65">{pack.description}</span>
                    <span className="mt-2 block font-semibold text-brand-900">
                      {tl(pack.price_minor)} {pack.currency}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="text-sm text-paper-800/75">
              Satın alma:{" "}
              <span className="font-medium text-paper-900">
                {sub ? `${sub.annualMonths} ay / ${tl(sub.annualPriceMinor)} TL` : "Yıllık paket"}
              </span>
            </div>
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
