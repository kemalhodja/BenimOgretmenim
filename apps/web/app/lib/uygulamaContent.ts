import type { UserRole } from "./auth";

export type UygulamaLink = {
  href: string;
  label: string;
  guestOnly?: boolean;
  /** Oturum açıkken birincil CTA */
  primary?: boolean;
};

export type UygulamaQuickAccess = {
  roles: UserRole[];
  title: string;
  body: string;
  links: UygulamaLink[];
};

export type UygulamaBenefit = {
  roles: UserRole[] | "all";
  title: string;
  body: string;
};

export type UygulamaTip = {
  roles: UserRole[] | "all";
  body: string;
};

export type RoleMeta = {
  label: string;
  badgeClass: string;
  cardRingClass: string;
};

export const ROLE_META: Record<UserRole, RoleMeta> = {
  student: {
    label: "Öğrenci",
    badgeClass: "bg-edu-blue-100 text-edu-blue-900 ring-edu-blue-200",
    cardRingClass: "ring-edu-blue-200",
  },
  teacher: {
    label: "Öğretmen",
    badgeClass: "bg-brand-100 text-brand-900 ring-brand-200",
    cardRingClass: "ring-brand-200",
  },
  guardian: {
    label: "Veli",
    badgeClass: "bg-warm-100 text-warm-900 ring-warm-200",
    cardRingClass: "ring-warm-200",
  },
  admin: {
    label: "Yönetici",
    badgeClass: "bg-paper-200 text-paper-950 ring-paper-300",
    cardRingClass: "ring-paper-300",
  },
};

export const UYGULAMA_QUICK_ACCESS: UygulamaQuickAccess[] = [
  {
    roles: ["student"],
    title: "Öğrenci hızlı başlangıç",
    body: "Öğretmen ara, soru gönder, çalışma planını işaretle ve canlı ders bağlantılarına telefondan ulaş.",
    links: [
      { href: "/student/panel", label: "Öğrenci paneli", primary: true },
      { href: "/student/odev-sor", label: "Soru gönder" },
      { href: "/student/calisma", label: "Çalışma planı" },
      { href: "/student/dersler", label: "Derslerim" },
      { href: "/ogretmenler", label: "Öğretmen ara" },
    ],
  },
  {
    roles: ["teacher"],
    title: "Öğretmen hızlı başlangıç",
    body: "Profilini tamamla, teklifleri takip et, soru havuzuna gir ve derslerini yönet.",
    links: [
      { href: "/teacher", label: "Öğretmen paneli", primary: true },
      { href: "/teacher/teklifler", label: "Tekliflerim" },
      { href: "/teacher/odev-havuzu", label: "Soru havuzu" },
      { href: "/teacher/dersler", label: "Derslerim" },
      { href: "/teacher/edit", label: "Profili tamamla" },
    ],
  },
  {
    roles: ["guardian"],
    title: "Veli hızlı takip",
    body: "Öğrencinin plan ilerlemesini, deneme ortalamasını ve ders bildirimlerini gör.",
    links: [
      { href: "/guardian", label: "Veli paneli", primary: true },
      { href: "/guardian/requests", label: "İlan takibi" },
      { href: "/student/kurslar", label: "Kurs başvuruları" },
      { href: "/kayit?role=guardian", label: "Veli hesabı aç", guestOnly: true },
    ],
  },
  {
    roles: ["admin"],
    title: "Yönetim hızlı erişim",
    body: "Operasyon, finans, destek ve moderasyon ekranlarına mobil kısayol.",
    links: [
      { href: "/admin/merkez", label: "Kontrol merkezi", primary: true },
      { href: "/admin/veri", label: "Veri panosu" },
      { href: "/admin/support", label: "Destek kuyruğu" },
      { href: "/admin/courses", label: "Kurs moderasyonu" },
    ],
  },
];

export const UYGULAMA_BENEFITS: UygulamaBenefit[] = [
  {
    roles: "all",
    title: "Ders bağlantısı hızlı açılır",
    body: "Canlı sınıf, bildirim ve panel bağlantıları ana ekrandan tek dokunuşla erişilir.",
  },
  {
    roles: ["student", "guardian"],
    title: "Soru fotoğrafı kolaylaşır",
    body: "Ödev ve sınav sorusunu telefondan kısa sürede gönderip takip edin.",
  },
  {
    roles: ["teacher"],
    title: "Öğretmen hızlı yanıtlar",
    body: "Teklifler, soru havuzu ve ders durumları mobilde daha hızlı kontrol edilir.",
  },
  {
    roles: ["admin"],
    title: "Operasyon takibi",
    body: "Kritik kuyruklar ve destek talepleri telefondan izlenebilir.",
  },
];

export const UYGULAMA_TIPS: UygulamaTip[] = [
  {
    roles: ["student", "guardian"],
    body: "Canlı ders bağlantılarına bildirimden veya paneldeki “Dersler” bölümünden girin.",
  },
  {
    roles: ["student"],
    body: "Soru fotoğrafı için “Soru gönder” sayfasındaki kamera seçeneğini kullanın.",
  },
  {
    roles: ["teacher"],
    body: "Soru havuzu ve teklif ekranlarını ana ekrana eklenen uygulamadan kontrol etmek daha hızlıdır.",
  },
  {
    roles: ["guardian"],
    body: "Veli panelinden haftalık plan ve bildirim özetini düzenli kontrol edin.",
  },
  {
    roles: ["admin"],
    body: "Acil operasyon için Kontrol merkezi ve Destek kuyruğunu kısayol olarak kullanın.",
  },
  {
    roles: "all",
    body: "Kurulum sonrası alt menü oturum rolünüze göre panel sayfalarını gösterir.",
  },
];

/** Kurulum tamamlandıktan sonra rol bazlı ilk adımlar */
export const POST_INSTALL_STEPS: Record<UserRole, string[]> = {
  student: [
    "Ana ekrandan açın; alt menüde Özet, Talepler ve Çalışma sekmeleri görünür.",
    "İlk sorunuzu “Soru gönder” ile yükleyin veya öğretmen aramaya başlayın.",
    "Bildirim iznini açın; ders ve teklif güncellemelerini kaçırmayın.",
  ],
  teacher: [
    "Ana ekrandan açın; Talepler, Dersler ve Profil sekmeleri hazır olur.",
    "Profilinizi tamamlayın; öğrenciler sizi bulabilsin.",
    "Soru havuzunu ve tekliflerinizi günde bir kez kontrol edin.",
  ],
  guardian: [
    "Ana ekrandan açın; Veli özeti ve ilan takibi alt menüde yer alır.",
    "Öğrenci bağlantınızı doğrulayın; plan ve bildirimler buradan gelir.",
    "Haftalık ilerleme özetini düzenli kontrol edin.",
  ],
  admin: [
    "Ana ekrandan açın; Merkez, Finans ve Destek kısayolları alt menüde.",
    "Kritik kuyrukları sabah ve akşam kısa turla kontrol edin.",
    "Mobilde yalnızca operasyon; finans onayları için masaüstü önerilir.",
  ],
};

const GUEST_PREVIEW_ROLES: UserRole[] = ["student", "teacher", "guardian"];

export function roleDisplayName(role: UserRole): string {
  return ROLE_META[role].label;
}

export function filterQuickAccess(role: UserRole | null, loggedIn: boolean): UygulamaQuickAccess[] {
  if (!loggedIn || !role) {
    return UYGULAMA_QUICK_ACCESS.filter((b) => GUEST_PREVIEW_ROLES.some((r) => b.roles.includes(r)));
  }
  return UYGULAMA_QUICK_ACCESS.filter((b) => b.roles.includes(role)).map((b) => ({
    ...b,
    links: b.links.filter((l) => !l.guestOnly),
  }));
}

export function filterBenefits(role: UserRole | null, loggedIn: boolean): UygulamaBenefit[] {
  if (!loggedIn || !role) return UYGULAMA_BENEFITS;
  return UYGULAMA_BENEFITS.filter(
    (b) => b.roles === "all" || (Array.isArray(b.roles) && b.roles.includes(role)),
  );
}

export function filterTips(role: UserRole | null, loggedIn: boolean): UygulamaTip[] {
  if (!loggedIn || !role) {
    const perRole = GUEST_PREVIEW_ROLES.flatMap((r) =>
      UYGULAMA_TIPS.filter((t) => Array.isArray(t.roles) && t.roles.includes(r)).slice(0, 1),
    );
    const general = UYGULAMA_TIPS.filter((t) => t.roles === "all");
    return [...perRole, ...general];
  }
  return UYGULAMA_TIPS.filter(
    (t) => t.roles === "all" || (Array.isArray(t.roles) && t.roles.includes(role)),
  );
}

export function roleIntro(role: UserRole): string {
  const name = roleDisplayName(role);
  return `${name} hesabınızla ana ekrana eklediğinizde yalnızca size uygun menü ve kısayollar görünür.`;
}

export function primaryQuickLink(
  blocks: UygulamaQuickAccess[],
): UygulamaLink | null {
  for (const block of blocks) {
    const primary = block.links.find((l) => l.primary);
    if (primary) return primary;
  }
  return blocks[0]?.links[0] ?? null;
}

export function quickAccessForRole(role: UserRole): UygulamaQuickAccess | undefined {
  return UYGULAMA_QUICK_ACCESS.find((b) => b.roles.includes(role));
}
