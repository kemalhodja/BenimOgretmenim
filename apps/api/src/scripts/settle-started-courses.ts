import { pool } from "../db.js";
import { settleStartedCourseCohort } from "../lib/courseEnrollmentWallet.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

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
    const r = await client.query<{ cohort_id: string; starts_at: string }>(
      `select due.cohort_id, due.starts_at
       from (
         select cc.id as cohort_id,
                coalesce(min(cs.scheduled_start), cc.starts_at) as starts_at
         from course_cohorts cc
         left join course_sessions cs on cs.cohort_id = cc.id and cs.scheduled_start is not null
         where cc.status in ('planned', 'active')
           and exists (
             select 1
             from course_enrollments ce
             where ce.cohort_id = cc.id and ce.payment_status = 'wallet_held'
           )
         group by cc.id, cc.starts_at
       ) due
       where due.starts_at is not null
         and due.starts_at <= now()
       order by due.starts_at asc
       limit 200`,
    );

    console.log(`[courses:settle-started] due_count=${r.rowCount}`);
    for (const row of r.rows) {
      try {
        const res = await settleStartedCourseCohort(row.cohort_id);
        console.log("[courses:settle-started] ok", row.cohort_id, res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[courses:settle-started] failed", row.cohort_id, msg);
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
