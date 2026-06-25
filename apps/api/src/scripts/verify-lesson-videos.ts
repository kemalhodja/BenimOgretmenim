/**
 * Migration 063–065 doğrulama (CI / deploy öncesi).
 *
 *   npm run db:verify:lesson-videos
 */
import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";
import { getLessonVideoSchemaStatus } from "../lib/lessonVideoDbReady.js";

async function main() {
  try {
    const status = await getLessonVideoSchemaStatus();
    console.log("[verify:lesson-videos]", JSON.stringify(status, null, 2));
    if (!status.ready) {
      console.error(
        "[verify:lesson-videos] FAIL — 063_teacher_lesson_videos, 064_lesson_video_views ve 065_lesson_video_moderation uygulanmalı.",
      );
      process.exitCode = 1;
    } else {
      console.log("[verify:lesson-videos] OK");
    }
  } catch (e) {
    console.error(formatDbConnectError(e));
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(formatDbConnectError(err));
  process.exit(1);
});
