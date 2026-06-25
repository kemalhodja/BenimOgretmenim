/**
 * uygulamaContent filtreleri — CI / yerel doğrulama.
 * npm run check:uygulama-content
 */
import {
  filterBenefits,
  filterQuickAccess,
  filterTips,
  primaryQuickLink,
  UYGULAMA_QUICK_ACCESS,
} from "../app/lib/uygulamaContent.js";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const guestQuick = filterQuickAccess(null, false);
assert(guestQuick.length === 3, "guest quick access: 3 rol önizlemesi");
assert(!guestQuick.some((b) => b.roles.includes("admin")), "guest: admin gizli");

const studentQuick = filterQuickAccess("student", true);
assert(studentQuick.length === 1, "student: tek blok");
assert(studentQuick[0]!.links.every((l) => !l.guestOnly), "student: guest link yok");
assert(Boolean(primaryQuickLink(studentQuick)?.primary), "student: primary link var");

const teacherBenefits = filterBenefits("teacher", true);
assert(teacherBenefits.some((b) => b.title.includes("Öğretmen")), "teacher benefits");

const guardianTips = filterTips("guardian", true);
assert(guardianTips.length >= 2, "guardian tips");

for (const block of UYGULAMA_QUICK_ACCESS) {
  assert(block.links.some((l) => l.primary), `${block.title}: primary link eksik`);
}

console.log("[check:uygulama-content] OK");
