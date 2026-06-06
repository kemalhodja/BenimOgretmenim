import "dotenv/config";
import { pool } from "../db.js";
import { releaseExpiredHomeworkClaims } from "../lib/homeworkPosts.js";
import { markJobFinished, markJobStarted } from "../lib/jobHeartbeat.js";

async function main() {
  await markJobStarted("homework:release-expired", 5);
  const n = await releaseExpiredHomeworkClaims(pool);
  console.log(`[homework:release] released ${n} expired claim(s).`);
  await markJobFinished("homework:release-expired", "success", { released: n });
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  markJobFinished("homework:release-expired", "failed", {}, e).catch(() => {});
  process.exit(1);
});
