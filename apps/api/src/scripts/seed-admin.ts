/**
 * Yönetici kullanıcıyı e-posta + parola ile oluşturur veya günceller (rol admin kalır).
 *
 * Giriş API’si e-posta kullanır; “kullanıcı adı” olarak e-postayı kullanın.
 *
 *   cd apps/api && npm run db:seed:admin
 *
 * Özelleştirme: ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, ADMIN_BOOTSTRAP_DISPLAY_NAME
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
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `insert into users (email, password_hash, display_name, role)
       values ($1, $2, $3, 'admin'::user_role)
       on conflict (email_normalized) do update set
         email = excluded.email,
         password_hash = excluded.password_hash,
         display_name = excluded.display_name,
         role = 'admin'::user_role,
         updated_at = now()
       returning id, email`,
      [email, hash, displayName],
    );

    const row = r.rows[0] as { id: string; email: string };
    console.log("Admin bootstrap tamam.");
    console.log("  Kullanıcı adı (giriş e-postası):", row.email);
    console.log("  Parola:", password);
    console.log("  user id:", row.id);
    console.log("");
    console.log("Sonraki: web girişinden /admin; API proxy için ADMIN_API_SECRET ayarlayın.");
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
