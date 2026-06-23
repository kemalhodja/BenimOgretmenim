export const ADMIN_BOOTSTRAP_DEFAULT_EMAIL = "admin@benimogretmenim.local";

export type AdminScope = "full" | "finance" | "support";

export const ADMIN_HOME = "/admin";
export const ADMIN_MERKEZ = "/admin/merkez";
export const ADMIN_COURSES_APPLICATIONS = "/admin/courses?tab=applications&pending=1";

/** SLA ihlali bu eşiği aşınca eskalasyon banner gösterilir. */
export const ADMIN_SLA_ESCALATION_THRESHOLD = 3;

/** Arama → talep dönüşümü bu yüzdenin altına düşerse funnel alarmı. */
export const ADMIN_FUNNEL_CONVERSION_ALERT_PERCENT = 5;

export type AdminNavItem = {
  href: string;
  title: string;
  desc: string;
  scopes?: AdminScope[];
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
  scopes?: AdminScope[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "Özet ve kimlik",
    scopes: ["full", "support"],
    items: [
      { href: ADMIN_HOME, title: "Operasyon özeti", desc: "Tüm KPI ve aksiyon kuyrukları" },
      { href: ADMIN_MERKEZ, title: "Kontrol merkezi", desc: "Sistem sağlığı, risk ve modül rehberi" },
      { href: "/admin/users", title: "Kullanıcılar", desc: "Arama, rol ve hesap durumu" },
      { href: "/admin/teachers", title: "Öğretmenler", desc: "Doğrulama ve profil kalitesi" },
      { href: "/admin/support", title: "Canlı destek", desc: "Kullanıcı mesajları ve yanıt" },
    ],
  },
  {
    title: "Finans ve abonelik",
    scopes: ["full", "finance"],
    items: [
      { href: "/admin/bank", title: "Havale onayı", desc: "Bekleyen banka transferleri" },
      { href: "/admin/payments", title: "Abonelik ödemeleri", desc: "Öğretmen abonelik kayıtları" },
      { href: "/admin/wallet", title: "Manuel cüzdan", desc: "Bakiye ekleme ve özet" },
      { href: "/admin/veri?k=ledger", title: "Cüzdan hareketleri", desc: "Tüm ledger kayıtları" },
      { href: "/admin/veri?k=wallet-topups", title: "Cüzdan yüklemeleri", desc: "PayTR kart yüklemeleri" },
      { href: "/admin/veri?k=teacher-withdrawals", title: "Para çekme", desc: "IBAN talepleri ve ödeme" },
      { href: "/admin/otomatik-cekim", title: "Otomatik çekim", desc: "Doğrulanmış öğretmen politikası" },
      { href: "/admin/destek-sla", title: "Destek SLA", desc: "24 saat yanıt hedefi" },
      { href: "/admin/veri?k=course-accounting", title: "Kurs muhasebesi", desc: "Tahsilat, iade ve hak ediş" },
      { href: "/admin/veri?k=reconciliation", title: "Ödeme kontrolü", desc: "PayTR uyumsuzlukları" },
      { href: "/admin/veri?k=job-monitoring", title: "Zamanlanmış işler", desc: "Cron ve alarm takibi" },
      { href: "/admin/veri?k=disputes", title: "İtiraz merkezi", desc: "Uyuşmazlık kayıtları" },
      { href: "/admin/veri?k=student-sub-payments", title: "Öğrenci ödemeleri", desc: "Platform abonelik kayıtları" },
      { href: "/admin/veri?k=teacher-campaigns", title: "Kampanya ilanları", desc: "Moderasyon kuyruğu" },
      { href: "/admin/veri?k=audit", title: "Yönetici audit", desc: "Kritik admin işlem geçmişi" },
    ],
  },
  {
    title: "İçerik ve ders",
    scopes: ["full", "support"],
    items: [
      { href: "/admin/courses", title: "Kurslar", desc: "Taslak, yayın ve başvuru kuyruğu" },
      { href: ADMIN_COURSES_APPLICATIONS, title: "Kurs başvuru kuyruğu", desc: "Bekleyen öğretmen/öğrenci başvuruları" },
      { href: "/admin/veri?k=enrollments", title: "Kurs kayıtları", desc: "Kayıt ve iade kararları" },
      { href: "/admin/requests", title: "Ders talepleri", desc: "Demo ve paket talepleri" },
      { href: "/admin/veri?k=packages", title: "Ders paketleri", desc: "Aktif paket kayıtları" },
      { href: "/admin/direct-bookings", title: "Doğrudan ders", desc: "Anlaşma ve iptal" },
      { href: "/admin/group-lessons", title: "Grup dersleri", desc: "Grup talep kuyruğu" },
      { href: "/admin/homework", title: "Ödev havuzu", desc: "Açık soru gönderileri" },
      { href: "/admin/veri?k=homework", title: "Soru kalitesi", desc: "Revizyon ve işaretleme" },
      { href: "/admin/veri?k=classroom", title: "Sınıf notları", desc: "Tahta kayıtları" },
      { href: "/admin/veri?k=recordings", title: "Sınıf kayıtları", desc: "Tekrar izleme" },
      { href: "/admin/veri?k=messages", title: "Sınıf mesajları", desc: "Sohbet ve sorular" },
      { href: "/admin/veri?k=learning", title: "Çalışma ve deneme", desc: "Planlar ve assessment" },
      { href: "/admin/veri?k=funnel", title: "Dönüşüm", desc: "Arama → talep → ödeme" },
    ],
  },
  {
    title: "Güven ve operasyon",
    scopes: ["full", "support", "finance"],
    items: [
      { href: "/admin/destek-sla", title: "Destek SLA paneli", desc: "Yanıt süresi ihlalleri" },
      { href: "/admin/veri?k=job-monitoring", title: "Cron / job izleme", desc: "Deploy smoke ve zamanlanmış işler" },
      { href: "/admin/veri?k=audit", title: "Yönetici audit", desc: "Kritik admin işlem geçmişi" },
    ],
  },
  {
    title: "Abonelik ve bildirim",
    scopes: ["full", "support"],
    items: [
      { href: "/admin/veri?k=teacher-subs", title: "Öğretmen abonelikleri", desc: "Aktif planlar" },
      { href: "/admin/veri?k=notifications", title: "Veli bildirimleri", desc: "Okunmamış uyarılar" },
      { href: "/admin/veri?k=guardian-invites", title: "Veli davetleri", desc: "Aktif ve süresi dolan kodlar" },
    ],
  },
];

export const ADMIN_DAILY_CHECKLIST = [
  { id: "bank", label: "Bekleyen havale onayları", href: "/admin/bank", scopes: ["full", "finance"] as AdminScope[] },
  { id: "sub-pay", label: "Bekleyen abonelik ödemeleri", href: "/admin/payments", scopes: ["full", "finance"] as AdminScope[] },
  { id: "withdrawals", label: "Para çekme talepleri", href: "/admin/veri?k=teacher-withdrawals&status=pending", scopes: ["full", "finance"] as AdminScope[] },
  { id: "reconciliation", label: "PayTR ödeme uyumsuzlukları", href: "/admin/veri?k=reconciliation", scopes: ["full", "finance"] as AdminScope[] },
  { id: "disputes", label: "Açık itirazlar", href: "/admin/veri?k=disputes", scopes: ["full", "finance"] as AdminScope[] },
  { id: "campaigns", label: "Kampanya moderasyonu", href: "/admin/veri?k=teacher-campaigns&status=pending_review", scopes: ["full", "support"] as AdminScope[] },
  { id: "course-apps", label: "Kurs başvuruları (öğretmen/öğrenci)", href: ADMIN_COURSES_APPLICATIONS, scopes: ["full", "support"] as AdminScope[] },
  { id: "teacher-verify", label: "Öğretmen doğrulama kuyruğu", href: "/admin/teachers", scopes: ["full", "support"] as AdminScope[] },
  { id: "demo", label: "Demo talepleri (yanıtsız)", href: "/admin/requests", scopes: ["full", "support"] as AdminScope[] },
  { id: "homework-sla", label: "Ödev SLA ihlalleri", href: "/admin/homework", scopes: ["full", "support"] as AdminScope[] },
  { id: "support-sla", label: "Destek SLA ihlalleri", href: "/admin/destek-sla", scopes: ["full", "support"] as AdminScope[] },
  { id: "homework-quality", label: "Soru kalite kuyruğu", href: "/admin/veri?k=homework", scopes: ["full", "support"] as AdminScope[] },
  { id: "jobs", label: "Zamanlanmış iş alarmları", href: "/admin/veri?k=job-monitoring", scopes: ["full", "finance", "support"] as AdminScope[] },
  { id: "guardian-invites", label: "Veli davet kodları", href: "/admin/veri?k=guardian-invites", scopes: ["full", "support"] as AdminScope[] },
  { id: "suspended", label: "Askıda hesaplar", href: "/admin/users?status=suspended", scopes: ["full", "support"] as AdminScope[] },
  { id: "deletion", label: "Silme talepleri", href: "/admin/users?status=deletion_requested", scopes: ["full", "support"] as AdminScope[] },
  { id: "system-health", label: "Sistem sağlığı ve deploy smoke", href: ADMIN_MERKEZ, scopes: ["full", "finance", "support"] as AdminScope[] },
  { id: "audit", label: "Admin audit kayıtları", href: "/admin/veri?k=audit", scopes: ["full", "finance", "support"] as AdminScope[] },
] as const;

export type AdminOverviewCounts = {
  usersTotal: number;
  teachers: number;
  students: number;
  coursesPublished: number;
  coursesDraft: number;
  coursesArchived?: number;
  lessonRequestsOpen: number;
  lessonRequestsMatched: number;
  groupLessonRequestsOpen: number;
  pendingBankPayments: number;
  pendingSubscriptionPayments: number;
  activeTeacherSubscriptions: number;
  lessonPackagesActive: number;
  activeStudentSubscriptions: number;
  walletsWithBalance: number;
  walletBalanceSumMinor: string;
  homeworkPostsActive: number;
  directBookingsInFlight: number;
  parentNotificationsUnread: number;
  openDemoRequests: number;
  unansweredDemoRequests: number;
  pendingTeacherVerification: number;
  weakTeacherProfiles: number;
  classroomNoteCount: number;
  classroomRecordingCount: number;
  classroomMessageCount: number;
  homeworkQualityQueue: number;
  openSupportThreads: number;
  activeStudyPlans: number;
  recentAssessmentAttempts: number;
  guardianInvitesActive?: number;
  guardianInvitesAccepted?: number;
  guardianInvitesExpired?: number;
  homeworkSlaBreaches: number;
  supportSlaBreaches: number;
  teacherQualityAvg: number;
  reconciliationIssues30d: number;
  completedLessons30d: number;
  pendingWithdrawals: number;
  openDisputes: number;
  pendingCampaignReview: number;
  pendingCourseTeacherApplications: number;
  pendingCourseStudentApplications: number;
  openJobAlerts: number;
  suspendedUsers: number;
  deletionRequestedUsers: number;
};

export type AdminOverviewRevenue7d = {
  teacherSubscriptionsMinor: number;
  studentSubscriptionsMinor: number;
  walletTopupsMinor: number;
  totalMinor: number;
};

export type AdminTrackingMetric = {
  key: keyof AdminOverviewCounts;
  label: string;
  href: string;
  hint?: (c: AdminOverviewCounts) => string;
  actionWhenPositive?: boolean;
  format?: (value: number, c: AdminOverviewCounts) => string | number;
  scopes?: AdminScope[];
};

export const ADMIN_TRACKING_SECTIONS: {
  title: string;
  metrics: AdminTrackingMetric[];
}[] = [
  {
    title: "Aksiyon gerekli",
    metrics: [
      { key: "pendingBankPayments", label: "Bekleyen havale", href: "/admin/bank", actionWhenPositive: true, scopes: ["full", "finance"] },
      { key: "pendingSubscriptionPayments", label: "Bekleyen abonelik ödemesi", href: "/admin/payments", actionWhenPositive: true, scopes: ["full", "finance"] },
      { key: "pendingWithdrawals", label: "Bekleyen para çekme", href: "/admin/veri?k=teacher-withdrawals&status=pending", actionWhenPositive: true, scopes: ["full", "finance"] },
      { key: "reconciliationIssues30d", label: "PayTR uyumsuzluğu (30g)", href: "/admin/veri?k=reconciliation", actionWhenPositive: true, scopes: ["full", "finance"] },
      { key: "openDisputes", label: "Açık itiraz", href: "/admin/veri?k=disputes", actionWhenPositive: true, scopes: ["full", "finance"] },
      { key: "pendingCampaignReview", label: "Kampanya moderasyonu", href: "/admin/veri?k=teacher-campaigns&status=pending_review", actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "pendingCourseTeacherApplications", label: "Kurs öğretmen başvurusu", href: ADMIN_COURSES_APPLICATIONS, actionWhenPositive: true, hint: (c) => c.pendingCourseStudentApplications > 0 ? `Öğrenci başvurusu: ${c.pendingCourseStudentApplications}` : "Kurs kuyruğundan incele", scopes: ["full", "support"] },
      { key: "pendingCourseStudentApplications", label: "Kurs öğrenci başvurusu", href: ADMIN_COURSES_APPLICATIONS, actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "pendingTeacherVerification", label: "Doğrulama bekleyen öğretmen", href: "/admin/teachers", actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "unansweredDemoRequests", label: "Yanıtsız demo talebi", href: "/admin/requests", actionWhenPositive: true, hint: (c) => `Açık demo: ${c.openDemoRequests}`, scopes: ["full", "support"] },
      { key: "homeworkSlaBreaches", label: "Geciken soru (SLA)", href: "/admin/homework", actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "supportSlaBreaches", label: "Geciken destek (SLA)", href: "/admin/destek-sla", actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "homeworkQualityQueue", label: "Soru kalite kuyruğu", href: "/admin/veri?k=homework", actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "openSupportThreads", label: "Açık destek", href: "/admin/support", actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "openJobAlerts", label: "Zamanlanmış iş alarmı", href: "/admin/veri?k=job-monitoring", actionWhenPositive: true },
      { key: "suspendedUsers", label: "Askıda hesap", href: "/admin/users?status=suspended", actionWhenPositive: true, scopes: ["full", "support"] },
      { key: "deletionRequestedUsers", label: "Silme talebi", href: "/admin/users?status=deletion_requested", actionWhenPositive: true, scopes: ["full", "support"] },
    ],
  },
  {
    title: "Finans ve abonelik",
    metrics: [
      { key: "walletsWithBalance", label: "Cüzdanı dolu kullanıcı", href: "/admin/wallet", hint: (c) => `Toplam: ${(Number(c.walletBalanceSumMinor ?? 0) / 100).toFixed(2)} TL`, scopes: ["full", "finance"] },
      { key: "activeTeacherSubscriptions", label: "Aktif öğretmen aboneliği", href: "/admin/veri?k=teacher-subs", scopes: ["full", "finance"] },
      { key: "activeStudentSubscriptions", label: "Aktif öğrenci aboneliği", href: "/admin/veri?k=student-sub-payments", scopes: ["full", "finance"] },
      { key: "lessonPackagesActive", label: "Aktif ders paketi", href: "/admin/veri?k=packages", scopes: ["full", "finance"] },
      { key: "directBookingsInFlight", label: "Doğrudan ders (devam)", href: "/admin/direct-bookings", scopes: ["full", "support"] },
    ],
  },
  {
    title: "Ders ve içerik",
    metrics: [
      { key: "lessonRequestsOpen", label: "Açık ders talebi", href: "/admin/requests", hint: (c) => `Eşleşmiş: ${c.lessonRequestsMatched}` },
      { key: "groupLessonRequestsOpen", label: "Açık grup dersi", href: "/admin/group-lessons" },
      { key: "homeworkPostsActive", label: "Açık ödev gönderisi", href: "/admin/homework" },
      { key: "coursesPublished", label: "Yayında kurs", href: "/admin/courses", hint: (c) => `Taslak: ${c.coursesDraft}` },
      { key: "completedLessons30d", label: "Tamamlanan ders (30g)", href: "/admin/veri?k=packages" },
      { key: "activeStudyPlans", label: "Aktif çalışma planı", href: "/admin/veri?k=learning" },
      { key: "recentAssessmentAttempts", label: "7g deneme kaydı", href: "/admin/veri?k=learning" },
    ],
  },
  {
    title: "Kalite ve güven",
    metrics: [
      { key: "weakTeacherProfiles", label: "Zayıf öğretmen profili", href: "/admin/teachers" },
      { key: "teacherQualityAvg", label: "Öğretmen kalite ort.", href: "/admin/teachers", format: (v) => `${v}/100` },
      { key: "openDemoRequests", label: "Açık demo talebi", href: "/admin/requests" },
      { key: "parentNotificationsUnread", label: "Okunmamış veli bildirimi", href: "/admin/veri?k=notifications" },
      { key: "guardianInvitesActive", label: "Aktif veli daveti", href: "/admin/veri?k=guardian-invites", hint: (c) => `Kabul: ${c.guardianInvitesAccepted ?? 0} · Süresi dolan: ${c.guardianInvitesExpired ?? 0}` },
    ],
  },
  {
    title: "Canlı sınıf ve kayıt",
    metrics: [
      { key: "classroomNoteCount", label: "Sınıf notu/tahta", href: "/admin/veri?k=classroom" },
      { key: "classroomRecordingCount", label: "Sınıf kaydı", href: "/admin/veri?k=recordings" },
      { key: "classroomMessageCount", label: "Sınıf mesajı", href: "/admin/veri?k=messages" },
    ],
  },
  {
    title: "Kullanıcı envanteri",
    metrics: [
      { key: "usersTotal", label: "Kayıtlı kullanıcı", href: "/admin/users" },
      { key: "teachers", label: "Öğretmen profili", href: "/admin/teachers" },
      { key: "students", label: "Öğrenci profili", href: "/admin/users" },
    ],
  },
];

export const ADMIN_TRACKING_FOOTER_LINKS = [
  { href: ADMIN_MERKEZ, label: "Kontrol merkezi" },
  { href: "/admin/veri?k=funnel", label: "Dönüşüm raporu" },
  { href: "/admin/veri?k=audit", label: "Audit kayıtları" },
  { href: "/admin/veri?k=ledger", label: "Cüzdan defteri" },
  { href: "/admin/otomatik-cekim", label: "Otomatik çekim" },
] as const;

export function metricValue(c: AdminOverviewCounts, key: keyof AdminOverviewCounts): number {
  const v = c[key];
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

export function actionMetrics(c: AdminOverviewCounts, scope: AdminScope = "full"): AdminTrackingMetric[] {
  const actionSection = ADMIN_TRACKING_SECTIONS[0];
  return actionSection.metrics.filter((m) => {
    if (!m.actionWhenPositive || metricValue(c, m.key) <= 0) return false;
    if (!m.scopes) return true;
    return scope === "full" || m.scopes.includes(scope);
  });
}

export function navSectionsForScope(scope: AdminScope): AdminNavSection[] {
  return ADMIN_NAV_SECTIONS.filter((section) => !section.scopes || section.scopes.includes(scope)).map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.scopes || item.scopes.includes(scope)),
  }));
}

export function checklistForScope(scope: AdminScope) {
  return ADMIN_DAILY_CHECKLIST.filter((item) => item.scopes.includes(scope));
}

export function formatRevenueMinor(minor: number): string {
  return `${(minor / 100).toFixed(2)} TL`;
}

export function weeklyReportNextSteps(report: {
  operations: { openPaymentRisks: number; pendingCampaignModeration: number; supportSlaBreaches: number };
  revenue: { teacherSubscriptionsMinor: number; studentSubscriptionsMinor: number; walletTopupsMinor: number };
}): { label: string; href: string }[] {
  const steps: { label: string; href: string }[] = [];
  if (report.operations.openPaymentRisks > 0) {
    steps.push({ label: "Açık ödeme risklerini kapat", href: "/admin/veri?k=reconciliation" });
  }
  if (report.operations.pendingCampaignModeration > 0) {
    steps.push({ label: "Kampanya moderasyon kuyruğunu işle", href: "/admin/veri?k=teacher-campaigns&status=pending_review" });
  }
  if (report.operations.supportSlaBreaches > 0) {
    steps.push({ label: "Destek SLA ihlallerini kapat", href: "/admin/destek-sla" });
  }
  const totalMinor =
    report.revenue.teacherSubscriptionsMinor + report.revenue.studentSubscriptionsMinor + report.revenue.walletTopupsMinor;
  if (totalMinor === 0) {
    steps.push({ label: "Dönüşüm hunisini incele (gelir yok)", href: "/admin/veri?k=funnel" });
  }
  if (steps.length === 0) {
    steps.push({ label: "Rutin kontrol merkezi turu", href: ADMIN_MERKEZ });
  }
  return steps;
}
