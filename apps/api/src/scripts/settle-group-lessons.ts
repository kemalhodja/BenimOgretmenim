import { pool } from "../db.js";
import { settleGroupLessonRequest } from "../routes/groupLessons.js";
import { formatDbConnectError } from "../lib/dbErrors.js";
import { markJobFinished, markJobStarted } from "../lib/jobHeartbeat.js";

/**
 * Planlanan dersten 1 saat önce tahsilat:
 * - charged_at is null
 * - planned_start <= now() + 1 hour
 * - planned_start > now() (geçmişe dönük tahsilat istemiyoruz)
 */
async function main() {
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error(formatDbConnectError(e));
    await pool.end().catch(() => {});
    process.exit(1);
  }

  try {
    await markJobStarted("group-lessons:settle", 10);
    const r = await client.query(
      `select id
       from group_lesson_requests
       where charged_at is null
         and planned_start > now()
         and planned_start <= now() + interval '1 hour'
         and status in ('open', 'teacher_assigned', 'scheduled')
       order by planned_start asc
       limit 200`,
    );

    console.log(`[group-lessons:settle] due_count=${r.rowCount}`);
    let failed = 0;

    for (const row of r.rows as Array<{ id: string }>) {
      try {
        const res = await settleGroupLessonRequest(row.id);
        console.log("[group-lessons:settle] ok", row.id, res);
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[group-lessons:settle] failed", row.id, msg);
      }
    }
    await markJobFinished("group-lessons:settle", failed > 0 ? "failed" : "success", {
      dueCount: r.rowCount,
      failed,
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(formatDbConnectError(e));
  markJobFinished("group-lessons:settle", "failed", {}, e).catch(() => {});
  process.exit(1);
});

