/**
 * Windows: Belirtilen portu dinleyen süreçleri sonlandırır.
 *   npx tsx src/scripts/free-port.ts 3001
 */
import { execFileSync } from "node:child_process";
import os from "node:os";

const port = Number(process.argv[2] ?? "");
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error("Kullanım: npx tsx src/scripts/free-port.ts <port>");
  console.error("Örnek: npx tsx src/scripts/free-port.ts 3001");
  process.exit(1);
}

if (os.platform() !== "win32") {
  console.error("[free-port] Şimdilik yalnızca Windows destekleniyor.");
  process.exit(1);
}

const cmd = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  `$p = Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess -Unique`,
  `if (-not $p) { Write-Host '[free-port] Port ${port} bos'; exit 0 }`,
  '$p | ForEach-Object { Write-Host ("[free-port] taskkill PID " + $_); taskkill /PID $_ /F }',
].join("; ");

try {
  execFileSync("powershell.exe", ["-NoProfile", "-Command", cmd], {
    stdio: "inherit",
    windowsHide: true,
  });
} catch {
  process.exitCode = 1;
}
