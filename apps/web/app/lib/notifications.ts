import type { UserRole } from "./auth";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
  payload_jsonb?: unknown;
  source?: string;
  presentation?: {
    kind: string;
    category: string;
    priority: NotificationPriority;
    actionLabel: string;
  };
};

export type NotificationSummary = {
  unread: number;
  total: number;
  byCategory: Record<string, number>;
  latestAt: string | null;
};

type PayloadShape = {
  kind?: string;
  href?: string;
  classroomHref?: string;
  actionHref?: string;
  homeworkPostId?: string;
  lessonSessionId?: string;
  courseSessionId?: string;
  requestId?: string;
  groupLessonId?: string;
  directBookingId?: string;
  videoId?: string;
  priority?: NotificationPriority;
  actionLabel?: string;
};

export function dispatchNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("bo:notifications-changed"));
}

export function notificationKind(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  return String((payload as PayloadShape).kind ?? "");
}

export function notificationPriority(payload: unknown): NotificationPriority {
  if (!payload || typeof payload !== "object") return "normal";
  const p = payload as PayloadShape;
  if (p.priority) return p.priority;
  const kind = p.kind ?? "";
  if (kind.includes("reminder_2h") || kind === "account_suspended") return "urgent";
  if (kind.includes("offer") || kind.includes("homework") || kind.includes("lesson_video")) return "high";
  if (kind.includes("digest") || kind.includes("weekly")) return "low";
  return "normal";
}

export function notificationCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    homework: "Ödev",
    video: "Video",
    lesson: "Ders",
    course: "Kurs",
    group: "Grup ders",
    booking: "Rezervasyon",
    offer: "Teklif",
    campaign: "Kampanya",
    account: "Hesap",
    study: "Çalışma",
    general: "Genel",
  };
  return map[category] ?? "Genel";
}

export function notificationKindLabel(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Genel";
  const kind = notificationKind(payload);
  if (kind.includes("homework")) return "Ödev";
  if (kind.includes("lesson_video")) return "Video";
  if (kind.includes("lesson_request") || kind.includes("lesson_offer")) return "Teklif";
  if (kind.includes("lesson")) return "Ders";
  if (kind.includes("course")) return "Kurs";
  if (kind.includes("group")) return "Grup ders";
  if (kind.includes("direct")) return "Doğrudan ders";
  if (kind.includes("campaign")) return "Kampanya";
  if (kind.includes("account")) return "Hesap";
  if (kind.includes("curriculum")) return "Kazanım";
  return "Genel";
}

export function notificationActionLabel(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Detaya git";
  const p = payload as PayloadShape;
  if (typeof p.actionLabel === "string" && p.actionLabel.trim()) return p.actionLabel;
  const kind = p.kind ?? "";
  if (kind.includes("lesson_video")) return "Videoyu aç";
  if (kind.includes("homework")) return "Gönderiyi aç";
  if (kind.includes("offer") || kind.includes("lesson_request")) return "Teklifi gör";
  if (kind.includes("classroom") || kind.includes("lesson")) return "Derse git";
  if (kind.includes("course")) return "Kursa git";
  if (kind.includes("group")) return "Grup dersi";
  if (kind.includes("direct_booking")) return "Rezervasyon";
  return "Detaya git";
}

function rolePrefix(role: UserRole | null | undefined): string {
  if (role === "teacher") return "/teacher";
  if (role === "guardian") return "/guardian";
  if (role === "admin") return "/admin";
  return "/student";
}

export function resolveNotificationHref(payload: unknown, role?: UserRole | null): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as PayloadShape;

  if (typeof o.href === "string" && o.href.startsWith("/")) return o.href;
  if (typeof o.classroomHref === "string" && o.classroomHref.startsWith("/classroom/")) {
    return o.classroomHref;
  }
  if (typeof o.actionHref === "string" && o.actionHref.startsWith("/")) return o.actionHref;

  const kind = o.kind ?? "";
  const prefix = rolePrefix(role);

  if (kind === "account_suspended") return "/hesap-askida";
  if (kind === "account_deletion_requested") return "/ayarlar/hesap";

  if (kind.includes("lesson_video")) {
    if (role === "guardian") return "/guardian/ders-videolari";
    return "/student/ders-videolari";
  }

  const isHomeworkKind =
    kind.includes("homework") &&
    !kind.endsWith("_guardian") &&
    role !== "guardian";
  if (o.homeworkPostId && isHomeworkKind) {
    return `${prefix === "/teacher" ? "/teacher" : "/student"}/odev-sor/${o.homeworkPostId}`;
  }

  if (role === "teacher") {
    if (
      kind === "lesson_scheduled" ||
      kind === "lesson_completed" ||
      kind === "lesson_reminder_24h" ||
      kind === "lesson_reminder_2h" ||
      o.lessonSessionId
    ) {
      return "/teacher/dersler";
    }
    if (
      kind.includes("course_session") ||
      o.courseSessionId
    ) {
      return "/teacher/kurslar";
    }
    if (kind.includes("group_lesson") || o.groupLessonId) return "/teacher/grup-dersler";
    if (kind.includes("direct_booking") || o.directBookingId) return "/teacher/dogrudan-dersler";
    if (
      (kind.includes("lesson_request") || kind.includes("lesson_offer")) &&
      typeof o.requestId === "string"
    ) {
      if (kind === "lesson_offer_accepted" || kind === "lesson_offer_rejected") {
        return `/teacher/requests/${o.requestId}`;
      }
      return "/teacher/requests";
    }
    if (kind.includes("homework")) return "/teacher/odev-havuzu";
  }

  if (role === "student" || !role) {
    if (kind === "lesson_scheduled" || kind === "lesson_completed" || o.lessonSessionId) {
      return "/student/dersler";
    }
    if (kind.includes("course_session") || o.courseSessionId) return "/student/kurslar";
    if (
      (kind === "lesson_offer_received" || kind === "lesson_demo_offer_received") &&
      typeof o.requestId === "string"
    ) {
      return `/student/requests/${o.requestId}`;
    }
    if (kind.includes("group_lesson") || o.groupLessonId) return "/student/grup-dersler";
    if (kind.includes("direct_booking") || o.directBookingId) return "/student/dogrudan-dersler";
    if (kind.includes("homework") && o.homeworkPostId) {
      return `/student/odev-sor/${o.homeworkPostId}`;
    }
  }

  if (role === "guardian") {
    if (kind.includes("homework") || kind.includes("curriculum") || kind === "guardian_weekly_report") {
      return kind === "guardian_weekly_report" ? "/guardian#haftalik-ozet" : "/guardian#bildirimler";
    }
    if (kind.includes("lesson") || kind.includes("classroom")) return "/guardian#bildirimler";
    return "/guardian";
  }

  if (role === "admin") {
    if (kind.includes("lesson_video")) return "/admin/lesson-videos";
    return "/admin";
  }

  return null;
}

export function formatNotificationWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} sa önce`;
  return d.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function groupNotificationsByDay(rows: NotificationRow[]): { label: string; items: NotificationRow[] }[] {
  const buckets = new Map<string, NotificationRow[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const row of rows) {
    const d = new Date(row.sent_at ?? row.created_at);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    let label: string;
    if (day.getTime() === today.getTime()) label = "Bugün";
    else if (day.getTime() === yesterday.getTime()) label = "Dün";
    else label = d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
    const list = buckets.get(label) ?? [];
    list.push(row);
    buckets.set(label, list);
  }
  return [...buckets.entries()].map(([label, items]) => ({ label, items }));
}

export function priorityBorderClass(priority: NotificationPriority, unread: boolean): string {
  if (!unread) return "border-paper-200 bg-white";
  if (priority === "urgent") return "border-red-300 bg-red-50/60";
  if (priority === "high") return "border-brand-300 bg-brand-50/70";
  if (priority === "low") return "border-paper-200 bg-paper-50/80";
  return "border-brand-200 bg-brand-50/50";
}
