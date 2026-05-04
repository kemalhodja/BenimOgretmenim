/**
 * `admin@benimogretmenim.local` (veya ADMIN_BOOTSTRAP_EMAIL) yoksa oluşturur.
 * `db:seed` ile gelen `seed_dev@` admininden bağımsızdır; böylece giriş e-postası tutarlı kalır.
 *
 *   npm run db:seed:bootstrap-admin-if-missing --prefix apps/api
 */
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

const DEFAULT_EMAIL = "admin@benimogretmenim.local";
const DEFAULT_PASSWORD = "BenimAdmin2026!";

async function main() {
  const emailRaw = process.env.ADMIN_BOOTSTRAP_EMAIL ?? DEFAULT_EMAIL;
  const email = emailRaw.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? DEFAULT_PASSWORD;
  const displayName = (process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME ?? "Yönetici").trim() || "Yönetici";

  if (!email.includes("@")) {
    console.error("ADMIN_BOOTSTRAP_EMAIL geçerli bir e-posta olmalıdır.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("ADMIN_BOOTSTRAP_PASSWORD en az 10 karakter olmalıdır.");
    process.exit(1);
  }

  try {
    const ex = await pool.query(`select id from users where email_normalized = $1`, [email]);
    if (ex.rowCount) {
      console.log("[seed-bootstrap-admin-if-missing] Zaten var:", email);
      await pool.end();
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `insert into users (email, password_hash, display_name, role)
       values ($1, $2, $3, 'admin'::user_role)
       returning id, email`,
      [email, hash, displayName],
    );
    const row = r.rows[0] as { id: string; email: string };
    console.log("[seed-bootstrap-admin-if-missing] Oluşturuldu:", row.email, "id:", row.id);
    await pool.end();
  } catch (e) {
    console.error(formatDbConnectError(e));
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(formatDbConnectError(err));
  process.exit(1);
});
