import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

const cwd = process.cwd();
dotenv.config({ path: path.join(cwd, ".env") });
dotenv.config({ path: path.join(cwd, "..", ".env") });

const devDefaultUrl =
  "postgres://benim:benim_dev_change_me@127.0.0.1:5432/benimogretmenim";

function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const examplePath = path.join(cwd, ".env.example");
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `DATABASE_URL is required. Örnek için bakın: ${examplePath}`,
    );
  }

  const hasLocalEnvFile = fs.existsSync(path.join(cwd, ".env"));
  if (!hasLocalEnvFile) {
    console.warn(
      "[db] .env bulunamadı; yerel geliştirme varsayılanı kullanılıyor (docker-compose ile uyumlu). " +
        `Kalıcı ayar için: copy .env.example .env  (${path.join(cwd, ".env")})`,
    );
  } else {
    console.warn(
      "[db] DATABASE_URL boş; yerel geliştirme varsayılanı kullanılıyor.",
    );
  }

  return devDefaultUrl;
}

const connectionString = resolveDatabaseUrl();

export const pool = new pg.Pool({
  connectionString,
  max: 10,
});
