import "dotenv/config";
import { pool } from "../db.js";
import { runGuardianWeeklyReports } from "../lib/guardianWeeklyReports.js";

async function main() {
  const result = await runGuardianWeeklyReports(pool);
  console.log("[guardian-weekly-reports]", JSON.stringify(result));
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
