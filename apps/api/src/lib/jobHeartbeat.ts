import { pool } from "../db.js";

export async function markJobStarted(jobName: string, expectedIntervalMinutes: number, metadata: Record<string, unknown> = {}) {
  await pool.query(
    `insert into platform_job_heartbeats (
       job_name, expected_interval_minutes, status, last_started_at, metadata_jsonb, updated_at
     )
     values ($1, $2, 'running', now(), $3::jsonb, now())
     on conflict (job_name) do update
     set expected_interval_minutes = excluded.expected_interval_minutes,
         status = 'running',
         last_started_at = now(),
         metadata_jsonb = platform_job_heartbeats.metadata_jsonb || excluded.metadata_jsonb,
         updated_at = now()`,
    [jobName, expectedIntervalMinutes, JSON.stringify(metadata)],
  );
}

export async function markJobFinished(
  jobName: string,
  status: "success" | "failed",
  metadata: Record<string, unknown> = {},
  error?: unknown,
) {
  const message = error instanceof Error ? error.message : error ? String(error) : null;
  await pool.query(
    `update platform_job_heartbeats
     set status = $2,
         last_finished_at = now(),
         last_success_at = case when $2 = 'success' then now() else last_success_at end,
         last_error = case when $2 = 'failed' then $3 else null end,
         run_count = run_count + 1,
         fail_count = fail_count + case when $2 = 'failed' then 1 else 0 end,
         metadata_jsonb = metadata_jsonb || $4::jsonb,
         updated_at = now()
     where job_name = $1`,
    [jobName, status, message, JSON.stringify(metadata)],
  );
}
