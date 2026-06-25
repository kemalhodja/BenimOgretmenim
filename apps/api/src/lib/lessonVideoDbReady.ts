import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

type Db = Pool | PoolClient;

export type LessonVideoSchemaStatus = {
  ready: boolean;
  tables: boolean;
  views: boolean;
  moderation: boolean;
};

export async function getLessonVideoSchemaStatus(client: Db = pool): Promise<LessonVideoSchemaStatus> {
  try {
    const r = await client.query<{
      tables: boolean;
      views: boolean;
      moderation: boolean;
    }>(
      `select
         to_regclass('public.teacher_lesson_videos') is not null as tables,
         to_regclass('public.lesson_video_views') is not null as views,
         exists (
           select 1 from information_schema.columns
           where table_schema = 'public'
             and table_name = 'teacher_lesson_videos'
             and column_name = 'moderation_status'
         ) as moderation`,
    );
    const tables = r.rows[0]?.tables === true;
    const views = r.rows[0]?.views === true;
    const moderation = r.rows[0]?.moderation === true;
    return {
      ready: tables && views && moderation,
      tables,
      views,
      moderation,
    };
  } catch {
    return { ready: false, tables: false, views: false, moderation: false };
  }
}
