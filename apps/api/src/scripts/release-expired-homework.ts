import "dotenv/config";
import { pool } from "../db.js";
import { releaseExpiredHomeworkClaims } from "../lib/homeworkPosts.js";

async function main() {
  const n = await releaseExpiredHomeworkClaims(pool);
  console.log(`[homework:release] released ${n} expired claim(s).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
