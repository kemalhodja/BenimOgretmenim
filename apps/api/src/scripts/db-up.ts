import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const repoRoot = path.resolve(__dirname, "../../../..");
const composeFile = path.join(repoRoot, "docker-compose.yml");

function dockerCandidates(): string[] {
  const pf = process.env["ProgramFiles"] ?? "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA;
  const out = new Set<string>();
  const add = (p?: string) => {
    const t = p?.trim();
    if (t) {
      out.add(t);
    }
  };
  add(process.env.DOCKER_PATH);
  add("docker");
  add(path.join(pf, "Docker", "Docker", "resources", "bin", "docker.exe"));
  add(path.join(pf86, "Docker", "Docker", "resources", "bin", "docker.exe"));
  if (local) {
    add(
      path.join(
        local,
        "Programs",
        "Docker",
        "Docker",
        "resources",
        "bin",
        "docker.exe",
      ),
    );
  }
  return [...out];
}

function waitPort(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} hazır olmadı (${timeoutMs} ms)`));
          return;
        }
        setTimeout(tryOnce, 800);
      });
    };
    tryOnce();
  });
}

function runDockerComposeUp(dockerExe: string) {
  return spawnSync(
    dockerExe,
    ["compose", "-f", composeFile, "up", "-d"],
    { stdio: "inherit", encoding: "utf-8" },
  );
}

async function main() {
  console.log("[db:up] docker compose ile PostgreSQL başlatılıyor…");
  console.log("[db:up] compose:", composeFile);

  const candidates = dockerCandidates();
  let lastENOENT = false;
  let ran = false;

  for (const dockerExe of candidates) {
    if (dockerExe !== "docker" && !fs.existsSync(dockerExe)) {
      continue;
    }
    ran = true;
    console.log("[db:up] denenen:", dockerExe);
    const r = runDockerComposeUp(dockerExe);
    if (r.error) {
      const err = r.error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        lastENOENT = true;
        continue;
      }
      console.error("[db:up] Docker hatası:", err.message);
      process.exit(1);
    }
    if (r.status !== 0) {
      console.error("[db:up] docker compose çıkış kodu:", r.status);
      process.exit(1);
    }
    lastENOENT = false;
    break;
  }

  if (lastENOENT || !ran) {
    console.error(
      [
        "[db:up] 'docker' çalıştırılamadı (PATH veya yaygın Windows kurulum yolları).",
        "",
        "Kurulum:",
        "- Docker Desktop: https://www.docker.com/products/docker-desktop/",
        "  Kurduktan sonra bilgisayarı yeniden başlatıp Docker'ı açın, sonra tekrar: npm run db:up",
        "",
        "Docker kullanmayacaksanız:",
        "- PostgreSQL Windows: https://www.postgresql.org/download/windows/",
        "- veya Neon: https://neon.tech → apps/api/.env içinde DATABASE_URL (sslmode=require)",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("[db:up] 127.0.0.1:5432 için bekleniyor (en fazla ~60 sn)…");
  try {
    await waitPort("127.0.0.1", 5432, 60_000);
  } catch (e) {
    console.error(
      "[db:up] Port açılmadı. Kontrol: Docker Desktop çalışıyor mu? Başka bir program 5432 kullanıyor mu?",
    );
    console.error(e);
    process.exit(1);
  }

  console.log("[db:up] Hazır. Sıradaki: npm run db:migrate && npm run db:seed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
