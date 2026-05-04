/** Rol bazlı site çerçevesi ve sekme başlığı için yol sınıflandırması */

export type PanelMode = "marketing" | "teacher" | "student" | "guardian" | "admin";

/** Sorgu ve sondaki / temizliği; kök yol her zaman `/` */
export function normalizePathname(pathname: string): string {
  const raw = (pathname.split("?")[0] ?? "/").trim();
  if (raw === "" || raw === "/") return "/";
  return raw.replace(/\/+$/, "");
}

export function panelModeForPath(pathname: string): PanelMode {
  const path = normalizePathname(pathname);
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/teacher" || path.startsWith("/teacher/")) return "teacher";
  if (path === "/student" || path.startsWith("/student/")) return "student";
  if (path === "/guardian" || path.startsWith("/guardian/")) return "guardian";
  return "marketing";
}

const SITE = "BenimÖğretmenim";

/** İstemci yönlendirmelerinde `document.title` (Tarayıcı sekmesi) */
export function documentTitleForPath(pathname: string): string {
  const path = normalizePathname(pathname);
  const mode = panelModeForPath(path);

  const exact: Record<string, string> = {
    "/": "Ana sayfa",
    "/teacher": "Panel özeti",
    "/teacher/requests": "Açık talepler",
    "/teacher/teklifler": "Verdiğim teklifler",
    "/teacher/dersler": "Ders oturumları",
    "/teacher/kurslar": "Online kurslarım",
    "/teacher/kurslar/yeni": "Yeni kurs",
    "/teacher/grup-dersler": "Grup ders ilanları",
    "/teacher/dogrudan-dersler": "Doğrudan ders anlaşmaları",
    "/teacher/odev-havuzu": "Ödev havuzu",
    "/teacher/cuzdan": "Cüzdan",
    "/teacher/edit": "Profil ve branş",
    "/student/requests": "Ders talepleri",
    "/student/panel": "Abonelik ve cüzdan",
    "/student/dersler": "Dersler ve yorum",
    "/student/dogrudan-dersler": "Doğrudan ders anlaşmaları",
    "/student/grup-dersler": "Grup ders talepleri",
    "/student/kurslar": "Kayıtlı kurslarım",
    "/student/odev-sor": "Ödev ve soru",
    "/student/odev-sor/gonderiler": "Gönderilerim",
    "/guardian": "Veli paneli",
    "/admin": "Yönetim özeti",
    "/admin/merkez": "Kontrol merkezi",
    "/admin/veri": "Veri görünümü",
    "/admin/group-lessons": "Grup ders talepleri",
    "/admin/homework": "Ödev gönderileri",
    "/admin/direct-bookings": "Doğrudan ders anlaşmaları",
    "/admin/bank": "Havale onayı",
    "/admin/users": "Kullanıcılar",
    "/admin/teachers": "Öğretmenler",
    "/admin/requests": "Ders talepleri",
    "/admin/wallet": "Cüzdan grant",
    "/admin/courses": "Kurslar",
    "/admin/payments": "Abonelik ödemeleri",
    "/login": "Giriş",
    "/kayit": "Kayıt",
    "/kampanya": "Kampanya",
    "/fiyatlar": "Fiyatlar",
    "/iletisim": "İletişim",
    "/yardim": "Yardım",
    "/gizlilik": "Gizlilik",
    "/kullanim-kosullari": "Kullanım koşulları",
    "/uygulama": "Uygulama",
    "/courses": "Kurslar",
    "/ogretmenler": "Öğretmen ara",
    "/odeme/ok": "Ödeme tamam",
    "/odeme/hata": "Ödeme hatası",
    "/panel": "Panele yönlendirme",
  };

  if (exact[path]) return `${exact[path]} · ${SITE}`;

  if (path.startsWith("/teacher/requests/")) return `Talep sohbeti · Öğretmen · ${SITE}`;
  if (path.startsWith("/teacher/kurslar/")) return `Kurs · Öğretmen · ${SITE}`;
  if (path.startsWith("/student/requests/")) return `Talep ve teklifler · Öğrenci · ${SITE}`;
  if (path.startsWith("/student/odev-sor/") && path !== "/student/odev-sor/gonderiler") {
    return `Gönderi detayı · Öğrenci · ${SITE}`;
  }
  if (path.startsWith("/student/kurslar/")) return `Kurs · Öğrenci · ${SITE}`;
  if (path.startsWith("/courses/") && path !== "/courses") return `Kurs detayı · ${SITE}`;
  if (path.startsWith("/ogretmenler/") && path !== "/ogretmenler") {
    return `Öğretmen profili · ${SITE}`;
  }

  if (mode === "teacher") return `Öğretmen · ${SITE}`;
  if (mode === "student") return `Öğrenci · ${SITE}`;
  if (mode === "guardian") return `Veli · ${SITE}`;
  if (mode === "admin") return `Yönetim · ${SITE}`;

  return SITE;
}
