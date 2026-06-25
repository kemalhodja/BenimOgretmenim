import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isHomeworkObjectStorageConfigured } from "../lib/homeworkObjectStorage.js";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function storageDir(): string | null {
  const dir = process.env.HOMEWORK_STORAGE_DIR?.trim();
  return dir && dir.length > 0 ? dir : null;
}

function safeKey(raw: string): string | null {
  const key = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!key || key.includes("..") || key.startsWith("/")) return null;
  if (!/^[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(key)) return null;
  return key;
}

export const homeworkMedia = new Hono();

/** Ödev görselleri — HOMEWORK_STORAGE_DIR + PUBLIC_BASE ile eşleşir. */
homeworkMedia.get("/*", async (c) => {
  if (!isHomeworkObjectStorageConfigured()) {
    return c.json({ error: "homework_storage_not_configured" }, 503);
  }
  const dir = storageDir();
  if (!dir) return c.json({ error: "homework_storage_not_configured" }, 503);

  const rel = c.req.path.replace(/^\//, "");
  const key = safeKey(rel);
  if (!key) return c.json({ error: "invalid_path" }, 400);

  const root = path.resolve(dir);
  const abs = path.resolve(root, key);
  if (!abs.startsWith(`${root}${path.sep}`) && abs !== root) {
    return c.json({ error: "forbidden" }, 403);
  }

  try {
    const data = await readFile(abs);
    const ext = key.split(".").pop()?.toLowerCase() ?? "jpg";
    return c.body(data, 200, {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=86400, immutable",
    });
  } catch {
    return c.json({ error: "not_found" }, 404);
  }
});
