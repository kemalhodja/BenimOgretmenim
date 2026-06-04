import "dotenv/config";
import { pool } from "../db.js";
import { runLessonReminderJob } from "../lib/lessonReminders.js";

async function main() {
  const result = await runLessonReminderJob(pool);
  console.log("[notifications:reminders]", JSON.stringify(result));
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
