import type { UserRole } from "./auth";
import { normalizePathname } from "./panelMode";

/** Yol hangi role ait panel alanında? */
export function pathRequiredRole(pathname: string): UserRole | null {
  const path = normalizePathname(pathname);
  if (path === "/student" || path.startsWith("/student/")) return "student";
  if (path === "/teacher" || path.startsWith("/teacher/")) return "teacher";
  if (path === "/guardian" || path.startsWith("/guardian/")) return "guardian";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  return null;
}

const SHARED_EXACT = new Set([
  "/",
  "/panel",
  "/login",
  "/kayit",
  "/iletisim",
  "/yardim",
  "/uygulama",
  "/fiyatlar",
  "/guven",
  "/gizlilik",
  "/kullanim-kosullari",
  "/itiraz",
  "/kampanya",
  "/kampanyalar",
  "/roller",
  "/mesajlar",
  "/bildirimler",
]);

const SHARED_PREFIXES = [
  "/ogretmenler",
  "/courses",
  "/kampanyalar/",
  "/odeme/",
  "/classroom/",
  "/ayarlar/",
];

function isSharedBrowsePath(path: string): boolean {
  if (SHARED_EXACT.has(path)) return true;
  return SHARED_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
}

/** Oturumdaki rol bu yola girebilir mi? */
export function isPathAllowedForRole(pathname: string, role: UserRole): boolean {
  const path = normalizePathname(pathname);
  const required = pathRequiredRole(path);
  if (!required) return isSharedBrowsePath(path);
  if (required === role) return true;
  // Veli: öğrenci kurs listesini salt okunur görür
  if (role === "guardian" && path.startsWith("/student/kurslar")) return true;
  return false;
}

/** Giriş / kayıt sonrası güvenli hedef (returnUrl rol ile uyumlu değilse panele düş). */
export function resolvePostAuthDestination(role: UserRole, returnUrl: string | null, fallback: string): string {
  if (returnUrl && isPathAllowedForRole(returnUrl, role)) return returnUrl;
  return fallback;
}
