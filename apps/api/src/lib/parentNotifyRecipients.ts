import type { Pool, PoolClient } from "pg";
import {
  notifyParentInApp,
  notifyParentInAppBulk,
  type InAppNotificationPayload,
} from "./inAppNotifications.js";

type Db = Pool | PoolClient | Pick<Pool, "query">;

/** Öğrenci kullanıcısı + bağlı veliler (student_id her satırda aynı). */
export const STUDENT_GUARDIANS_RECIPIENTS_SQL = `
  select st.user_id as recipient_user_id, st.id as student_id
  from students st
  where st.id = $1::uuid
  union
  select sg.guardian_user_id as recipient_user_id, $1::uuid as student_id
  from student_guardians sg
  where sg.student_id = $1::uuid`;

export async function notifyStudentAndGuardians(
  client: Db,
  studentId: string,
  title: string,
  body: string,
  payload: InAppNotificationPayload,
): Promise<number> {
  return notifyParentInAppBulk(
    client,
    STUDENT_GUARDIANS_RECIPIENTS_SQL,
    [studentId],
    title,
    body,
    payload,
  );
}

export async function notifyTeacherByTeacherId(
  client: Db,
  teacherId: string,
  studentId: string | null,
  title: string,
  body: string,
  payload: InAppNotificationPayload,
): Promise<boolean> {
  const r = await client.query<{ user_id: string }>(
    `select u.id as user_id from teachers t join users u on u.id = t.user_id where t.id = $1`,
    [teacherId],
  );
  if (!r.rowCount) return false;
  const result = await notifyParentInApp(r.rows[0]!.user_id, title, body, payload, { studentId }, client);
  return result.sent;
}

const TEACHERS_IN_BRANCH_SQL = `
  select u.id as recipient_user_id, $2::uuid as student_id
  from teacher_branches tb
  join teachers t on t.id = tb.teacher_id
  join users u on u.id = t.user_id
  where tb.branch_id = $1::int and u.role = 'teacher'
  order by tb.created_at desc nulls last
  limit 200`;

export async function notifyTeachersInBranch(
  client: Db,
  branchId: number | string,
  studentId: string,
  title: string,
  body: string,
  payload: InAppNotificationPayload,
): Promise<number> {
  return notifyParentInAppBulk(
    client,
    TEACHERS_IN_BRANCH_SQL,
    [branchId, studentId],
    title,
    body,
    payload,
  );
}
