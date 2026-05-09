import { z } from "zod";
import { pool } from "../db.js";

/**
 * Ödev/teşekkür ödemesi: öğretmene aktarılan tutar bu kullanıcının `user_wallets` bakiyesinden düşer.
 *
 * Üretimde **zorunlu**: `PLATFORM_HOMEWORK_WALLET_USER_ID` (geçerli bir `users.id`).
 * Admin `/v1/wallet/admin/grant` ile bu kullanıcıya bakiye yükler (“havuz”).
 *
 * Geliştirme/smoke: env yoksa ilk kayıtlı admin kullanıcısı kullanılır (kolaylık).
 */
export async function resolvePlatformHomeworkWalletUserId(): Promise<string | null> {
  const raw = process.env.PLATFORM_HOMEWORK_WALLET_USER_ID?.trim();
  if (raw && z.string().uuid().safeParse(raw).success) return raw;
  if (process.env.NODE_ENV === "production") return null;
  const r = await pool.query(
    `select id::text as id from users where role = 'admin' order by created_at asc nulls last limit 1`,
  );
  const id = r.rows[0]?.id;
  return typeof id === "string" && z.string().uuid().safeParse(id).success ? id : null;
}
