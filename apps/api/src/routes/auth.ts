import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { signAccessToken } from "../auth/jwt.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";

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
       returning id, email, display_name, role, created_at`,
      [email, hash, displayName, role],
    );
    const user = u.rows[0] as {
      id: string;
      email: string;
      display_name: string;
      role: string;
      created_at: Date;
    };

    if (role === "teacher") {
      await client.query(`insert into teachers (user_id) values ($1)`, [user.id]);
    }
    if (role === "student") {
      await client.query(`insert into students (user_id) values ($1)`, [user.id]);
    }

    await client.query("commit");

    const token = await signAccessToken({ userId: user.id, role: user.role });
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
    `select id, email, display_name, role, password_hash from users where email_normalized = lower(trim($1::text))`,
    [email],
  );
  const row = r.rows[0] as
    | {
        id: string;
        email: string;
        display_name: string;
        role: string;
        password_hash: string | null;
      }
    | undefined;

  if (!row?.password_hash) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  const token = await signAccessToken({ userId: row.id, role: row.role });
  return c.json({
    token,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    },
  });
});

auth.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const r = await pool.query(
    `select id, email, display_name, role, created_at from users where id = $1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ user: row });
});
