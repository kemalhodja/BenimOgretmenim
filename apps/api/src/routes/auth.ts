import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { signAccessToken } from "../auth/jwt.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { clearSessionCookie, hasValidCsrfHeader, setSessionCookie, setSessionHintCookies } from "../auth/sessionCookie.js";
import { loadUserAccountStatus, notifyUserInApp } from "../lib/accountLifecycle.js";

const deletionRequestSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
  confirmEmail: z.string().email(),
});

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(120),
  role: z.enum(["student", "teacher", "guardian"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const auth = new Hono<{ Variables: AppVariables }>();

// Brute-force protection: tighter limits for credential-bearing endpoints.
auth.use("/register", rateLimit({ name: "auth_register", limit: 15, windowMs: 60_000 }));
auth.use("/login", rateLimit({ name: "auth_login", limit: 10, windowMs: 60_000 }));
auth.use("*", rateLimit({ name: "auth_other", limit: 60, windowMs: 60_000 }));

auth.post("/register", async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { email, password, displayName, role } = parsed.data;
  const hash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const u = await client.query(
      `insert into users (email, password_hash, display_name, role)
       values ($1, $2, $3, $4::user_role)
       returning id, email, display_name, role, admin_scope::text as admin_scope, created_at`,
      [email, hash, displayName, role],
    );
    const user = u.rows[0] as {
      id: string;
      email: string;
      display_name: string;
      role: string;
      admin_scope: string | null;
      created_at: Date;
    };

    if (role === "teacher") {
      await client.query(`insert into teachers (user_id) values ($1)`, [user.id]);
    }
    if (role === "student") {
      await client.query(`insert into students (user_id) values ($1)`, [user.id]);
    }

    await client.query("commit");

    const token = await signAccessToken({
      userId: user.id,
      role: user.role,
      adminScope: user.role === "admin" ? (user.admin_scope ?? "full") : null,
    });
    setSessionCookie(c, token);
    setSessionHintCookies(c, {
      role: user.role,
      userId: user.id,
      adminScope: user.role === "admin" ? (user.admin_scope ?? "full") : null,
    });
    return c.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          createdAt: user.created_at,
        },
      },
      201,
    );
  } catch (e) {
    await client.query("rollback");
    const err = e as { code?: string };
    if (err.code === "23505") {
      return c.json({ error: "email_already_registered" }, 409);
    }
    throw e;
  } finally {
    client.release();
  }
});

auth.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;
  const r = await pool.query(
    `select id, email, display_name, role, password_hash,
            admin_scope::text as admin_scope,
            account_status::text as account_status,
            suspension_reason,
            suspended_at::text as suspended_at,
            deletion_requested_at::text as deletion_requested_at,
            deletion_reason
     from users where email_normalized = lower(trim($1::text))`,
    [email],
  );
  const row = r.rows[0] as
    | {
        id: string;
        email: string;
        display_name: string;
        role: string;
        admin_scope: string | null;
        password_hash: string | null;
        account_status: string;
        suspension_reason: string | null;
        suspended_at: string | null;
        deletion_requested_at: string | null;
        deletion_reason: string | null;
      }
    | undefined;

  if (!row?.password_hash) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  await pool.query(`update users set last_login_at = now(), updated_at = now() where id = $1`, [row.id]);

  const token = await signAccessToken({
    userId: row.id,
    role: row.role,
    adminScope: row.role === "admin" ? (row.admin_scope ?? "full") : null,
  });
  setSessionCookie(c, token);
  setSessionHintCookies(c, {
    role: row.role,
    userId: row.id,
    adminScope: row.role === "admin" ? (row.admin_scope ?? "full") : null,
  });
  return c.json({
    token,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      adminScope: row.role === "admin" ? (row.admin_scope ?? "full") : null,
    },
    account: {
      status: row.account_status ?? "active",
      suspensionReason: row.suspension_reason,
      suspendedAt: row.suspended_at,
      deletionRequestedAt: row.deletion_requested_at,
      deletionReason: row.deletion_reason,
    },
  });
});

auth.post("/logout", (c) => {
  if (!hasValidCsrfHeader(c)) {
    return c.json({ error: "csrf_token_required" }, 403);
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

auth.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const r = await pool.query(
    `select id, email, display_name, role, admin_scope::text as admin_scope, created_at,
            account_status::text as account_status,
            suspension_reason,
            suspended_at::text as suspended_at,
            deletion_requested_at::text as deletion_requested_at,
            deletion_reason
     from users where id = $1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({
    user: {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: row.role,
      adminScope: row.role === "admin" ? (row.admin_scope ?? "full") : null,
      created_at: row.created_at,
    },
    account: {
      status: row.account_status ?? "active",
      suspensionReason: row.suspension_reason,
      suspendedAt: row.suspended_at,
      deletionRequestedAt: row.deletion_requested_at,
      deletionReason: row.deletion_reason,
    },
  });
});

auth.post("/account/deletion-request", requireAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = deletionRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const u = await pool.query<{ email: string; account_status: string }>(
    `select email, account_status::text as account_status from users where id = $1`,
    [userId],
  );
  const user = u.rows[0];
  if (!user) return c.json({ error: "not_found" }, 404);
  if (user.email.toLowerCase() !== parsed.data.confirmEmail.toLowerCase()) {
    return c.json({ error: "email_confirmation_mismatch" }, 400);
  }
  if (user.account_status === "deletion_requested") {
    return c.json({ ok: true, alreadyRequested: true });
  }

  await pool.query(
    `update users
     set account_status = 'deletion_requested',
         deletion_requested_at = now(),
         deletion_reason = $2,
         updated_at = now()
     where id = $1`,
    [userId, parsed.data.reason],
  );
  await notifyUserInApp(
    userId,
    "Hesap silme talebiniz alındı",
    "Talebiniz destek ekibimize iletildi. İşlem tamamlanana kadar hesabınız kısıtlı modda kalabilir.",
    { kind: "account_deletion_requested", href: "/ayarlar/hesap" },
  );
  return c.json({ ok: true });
});

auth.post("/account/deletion-request/cancel", requireAuth, async (c) => {
  const userId = c.get("userId");
  const r = await pool.query(
    `update users
     set account_status = 'active',
         deletion_requested_at = null,
         deletion_reason = null,
         updated_at = now()
     where id = $1 and account_status = 'deletion_requested'
     returning id`,
    [userId],
  );
  if (!r.rowCount) return c.json({ error: "no_pending_deletion_request" }, 404);
  await notifyUserInApp(
    userId,
    "Hesap silme talebi iptal edildi",
    "Hesabınız tekrar aktif modda kullanılabilir.",
    { kind: "account_deletion_cancelled", href: "/panel" },
  );
  return c.json({ ok: true });
});
