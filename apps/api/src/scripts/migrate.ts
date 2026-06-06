import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";
import { seedTurkeyGeoIfNeeded } from "../lib/trGeoSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function checksumSql(sql: string): string {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

async function main() {
  const migrationsDir = path.resolve(__dirname, "../../../../db/migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error(formatDbConnectError(e));
    await pool.end().catch(() => {});
    process.exit(1);
  }
  try {
    await client.query(`
      create table if not exists schema_migrations (
        id serial primary key,
        filename text not null unique,
        checksum_sha256 text,
        applied_at timestamptz not null default now()
      );
    `);
    await client.query(`alter table schema_migrations add column if not exists checksum_sha256 text`);
    await client.query(`select pg_advisory_lock(hashtext('schema_migrations'))`);

    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      const checksum = checksumSql(sql);
      const applied = await client.query(
        "select checksum_sha256 from schema_migrations where filename = $1",
        [file],
      );
      if (applied.rowCount) {
        const storedChecksum = applied.rows[0]?.checksum_sha256 as string | null | undefined;
        if (storedChecksum && storedChecksum !== checksum) {
          throw new Error(
            `[migrate] Migration drift detected for ${file}: stored=${storedChecksum} current=${checksum}`,
          );
        }
        if (!storedChecksum) {
          await client.query(
            "update schema_migrations set checksum_sha256 = $2 where filename = $1 and checksum_sha256 is null",
            [file, checksum],
          );
        }
        console.log("skip", file);
        continue;
      }

      try {
        await client.query(sql);
      } catch (e) {
        console.error(`[migrate] SQL hata — dosya: ${file}`);
        throw e;
      }
      await client.query("insert into schema_migrations (filename, checksum_sha256) values ($1, $2)", [
        file,
        checksum,
      ]);
      console.log("applied", file);
    }

    // Referans geo veri (TR): idempotent seed (81 il + tüm ilçeler).
    await seedTurkeyGeoIfNeeded(client);
  } finally {
    await client.query(`select pg_advisory_unlock(hashtext('schema_migrations'))`).catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(formatDbConnectError(err));
  process.exit(1);
});
