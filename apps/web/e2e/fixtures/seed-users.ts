/**
 * Yerel seed ile uyumlu hesaplar — apps/api seed-dev.ts ve login sayfası ön ayarları ile aynı.
 * E2E öncesi: PostgreSQL + migrate + seed (ve isteğe bağlı db:seed:admin).
 */
export const SEED_USERS = {
  student: {
    email: "student_dev@benimogretmenim.local",
    password: "DevParola1",
  },
  teacher: {
    email: "teacher_dev@benimogretmenim.local",
    password: "DevParola1",
  },
  guardian: {
    email: "guardian_dev@benimogretmenim.local",
    password: "DevParola1",
  },
  /** npm run db:seed:admin — ayrı bootstrap script */
  adminBootstrap: {
    email: "admin@benimogretmenim.local",
    password: process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "",
  },
  /** npm run db:seed tam seed içindeki opsiyonel admin */
  adminSeed: {
    email: "seed_dev@benimogretmenim.local",
    password: "DevParola1",
  },
} as const;
