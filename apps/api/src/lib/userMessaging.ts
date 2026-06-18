import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

type Db = Pool | PoolClient;

function isMissingRelation(error: unknown): boolean {
  const e = error as { code?: string };
  return e?.code === "42P01";
}

export async function ensureDirectBookingThread(
  input: { bookingId: string; studentId: string; teacherId: string },
  client: Db = pool,
): Promise<string | null> {
  try {
    const existing = await client.query<{ id: string }>(
      `select id from user_message_threads where direct_booking_id = $1`,
      [input.bookingId],
    );
    if (existing.rows[0]?.id) return existing.rows[0].id;

    const ins = await client.query<{ id: string }>(
      `insert into user_message_threads (
         kind, subject, student_id, teacher_id, direct_booking_id, last_message_at
       ) values ('direct_booking', $1, $2, $3, $4, now())
       returning id`,
      [
        "Doğrudan ders anlaşması",
        input.studentId,
        input.teacherId,
        input.bookingId,
      ],
    );
    return ins.rows[0]?.id ?? null;
  } catch (e) {
    if (isMissingRelation(e)) return null;
    throw e;
  }
}

export async function listThreadsForUser(
  userId: string,
  role: string,
  client: Db = pool,
): Promise<
  Array<{
    id: string;
    kind: string;
    subject: string | null;
    last_message_at: string | null;
    counterpart_display_name: string | null;
    last_body_preview: string | null;
    unread_count: number;
  }>
> {
  try {
    if (role === "student") {
      const r = await client.query(
        `select t.id,
                t.kind,
                t.subject,
                t.last_message_at,
                u.display_name as counterpart_display_name,
                (
                  select m.body_text
                  from user_messages m
                  where m.thread_id = t.id
                  order by m.created_at desc
                  limit 1
                ) as last_body_preview,
                (
                  select count(*)::int
                  from user_messages m
                  where m.thread_id = t.id
                    and m.sender_user_id <> $1
                    and m.read_at is null
                ) as unread_count
         from user_message_threads t
         join students s on s.id = t.student_id
         left join teachers tt on tt.id = t.teacher_id
         left join users u on u.id = tt.user_id
         where s.user_id = $1
         order by t.last_message_at desc nulls last, t.created_at desc
         limit 100`,
        [userId],
      );
      return r.rows as Array<{
        id: string;
        kind: string;
        subject: string | null;
        last_message_at: string | null;
        counterpart_display_name: string | null;
        last_body_preview: string | null;
        unread_count: number;
      }>;
    }

    if (role === "teacher") {
      const r = await client.query(
        `select t.id,
                t.kind,
                t.subject,
                t.last_message_at,
                u.display_name as counterpart_display_name,
                (
                  select m.body_text
                  from user_messages m
                  where m.thread_id = t.id
                  order by m.created_at desc
                  limit 1
                ) as last_body_preview,
                (
                  select count(*)::int
                  from user_messages m
                  where m.thread_id = t.id
                    and m.sender_user_id <> $1
                    and m.read_at is null
                ) as unread_count
         from user_message_threads t
         join teachers tt on tt.id = t.teacher_id
         left join students st on st.id = t.student_id
         left join users u on u.id = st.user_id
         where tt.user_id = $1
         order by t.last_message_at desc nulls last, t.created_at desc
         limit 100`,
        [userId],
      );
      return r.rows as Array<{
        id: string;
        kind: string;
        subject: string | null;
        last_message_at: string | null;
        counterpart_display_name: string | null;
        last_body_preview: string | null;
        unread_count: number;
      }>;
    }

    return [];
  } catch (e) {
    if (isMissingRelation(e)) return [];
    throw e;
  }
}
