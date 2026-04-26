import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "../..");

function main() {
  const envPath = path.join(apiRoot, ".env");
  const examplePath = path.join(apiRoot, ".env.example");

  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log("[setup] .env oluşturuldu (.env.example kopyalandı).");
  } else if (fs.existsSync(envPath)) {
    console.log("[setup] .env zaten var.");
  } else {
    console.warn("[setup] .env.example bulunamadı; .env oluşturulamadı.");
  }

  console.log(`
Sonraki adımlar:
1) Docker Desktop varsa: npm run db:up   (PostgreSQL 5432)
   Yoksa: yerel PostgreSQL veya bulut DATABASE_URL (apps/api/.env)
2) npm run db:migrate
3) npm run db:seed   (isteğe bağlı geliştirici verisi)
4) npm run dev
`);
}

main();
