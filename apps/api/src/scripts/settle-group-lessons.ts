import { pool } from "../db.js";
import { settleGroupLessonRequest } from "../routes/groupLessons.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

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

    for (const row of r.rows as Array<{ id: string }>) {
      try {
        const res = await settleGroupLessonRequest(row.id);
        console.log("[group-lessons:settle] ok", row.id, res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[group-lessons:settle] failed", row.id, msg);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(formatDbConnectError(e));
  process.exit(1);
});

