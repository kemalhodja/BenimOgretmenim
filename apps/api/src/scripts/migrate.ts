import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
        applied_at timestamptz not null default now()
      );
    `);

    for (const file of files) {
      const applied = await client.query(
        "select 1 from schema_migrations where filename = $1",
        [file],
      );
      if (applied.rowCount) {
        console.log("skip", file);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      try {
        await client.query(sql);
      } catch (e) {
        console.error(`[migrate] SQL hata — dosya: ${file}`);
        throw e;
      }
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      console.log("applied", file);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(formatDbConnectError(err));
  process.exit(1);
});
