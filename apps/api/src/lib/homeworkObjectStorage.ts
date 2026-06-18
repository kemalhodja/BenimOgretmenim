import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

type Db = Pool | PoolClient;

const DATA_URL_RE = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i;

function storageDir(): string | null {
  const dir = process.env.HOMEWORK_STORAGE_DIR?.trim();
  return dir && dir.length > 0 ? dir : null;
}

function publicBaseUrl(): string | null {
  const base = process.env.HOMEWORK_STORAGE_PUBLIC_BASE?.trim();
  return base && base.length > 0 ? base.replace(/\/$/, "") : null;
}

export function isHomeworkObjectStorageConfigured(): boolean {
  return Boolean(storageDir() && publicBaseUrl());
}

export function homeworkStorageBackendLabel(): string {
  if (isHomeworkObjectStorageConfigured()) return "object_storage_v1";
  return "inline_data_url_pending_object_storage";
}

async function persistDataUrl(
  dataUrl: string,
  ownerUserId: string,
  homeworkPostId: string | null,
  client: Db,
): Promise<string | null> {
  const dir = storageDir();
  const base = publicBaseUrl();
  if (!dir || !base) return null;

  const match = dataUrl.match(DATA_URL_RE);
  if (!match) return null;
  const contentType = match[1].toLowerCase().replace("jpg", "jpeg");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length < 32 || buffer.length > 4_000_000) return null;

  const key = `${ownerUserId}/${homeworkPostId ?? "draft"}/${randomUUID()}.${ext}`;
  const absPath = path.join(dir, key);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);

  const publicUrl = `${base}/${key.replace(/\\/g, "/")}`;
  try {
    await client.query(
      `insert into homework_media_assets (
         owner_user_id, homework_post_id, storage_key, public_url, content_type, byte_size
       ) values ($1, $2, $3, $4, $5, $6)`,
      [ownerUserId, homeworkPostId, key, publicUrl, contentType, buffer.length],
    );
  } catch {
    /* tablo yoksa URL yine döner */
  }
  return publicUrl;
}

export async function persistHomeworkImageUrls(
  imageUrls: string[],
  ownerUserId: string,
  homeworkPostId: string | null,
  client: Db = pool,
): Promise<{ urls: string[]; backend: string }> {
  if (!isHomeworkObjectStorageConfigured()) {
    return { urls: imageUrls, backend: homeworkStorageBackendLabel() };
  }
  const out: string[] = [];
  for (const url of imageUrls) {
    if (/^https:\/\//i.test(url)) {
      out.push(url);
      continue;
    }
    if (DATA_URL_RE.test(url)) {
      const stored = await persistDataUrl(url, ownerUserId, homeworkPostId, client);
      out.push(stored ?? url);
      continue;
    }
    out.push(url);
  }
  return { urls: out, backend: "object_storage_v1" };
}

export async function linkHomeworkMediaToPost(
  homeworkPostId: string,
  ownerUserId: string,
  client: Db = pool,
): Promise<void> {
  try {
    await client.query(
      `update homework_media_assets
       set homework_post_id = $1
       where owner_user_id = $2 and homework_post_id is null`,
      [homeworkPostId, ownerUserId],
    );
  } catch {
    /* optional table */
  }
}
