import net from "node:net";

const host = process.env.PGHOST ?? "127.0.0.1";
const port = Number(process.env.PGPORT ?? "5432");

function checkOnce(): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createConnection({ host, port }, () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => {
      s.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const ok = await checkOnce();
  if (ok) {
    console.log(`[db:check] ${host}:${port} açık.`);
    process.exit(0);
  }
  console.error(
    [
      `[db:check] ${host}:${port} kapalı (PostgreSQL dinlemiyor).`,
      "",
      "Çözüm:",
      "- Docker Desktop kullanıyorsanız: Docker'ı açın → npm run db:up → npm run db:migrate → npm run db:seed",
      "- Docker yoksa: yerel PostgreSQL kurun veya Neon gibi bir servis için apps/api/.env içinde DATABASE_URL ayarlayın",
    ].join("\n"),
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
