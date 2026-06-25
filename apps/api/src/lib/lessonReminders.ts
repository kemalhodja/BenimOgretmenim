import { pool } from "../db.js";
import { queueUserEmail } from "./emailDelivery.js";
import { queueUserSms } from "./smsDelivery.js";

type ReminderWindow = {
  kind: "lesson_reminder_24h" | "lesson_reminder_2h";
  label: string;
  lowerMinutes: number;
  upperMinutes: number;
};

type Queryable = Pick<typeof pool, "query">;

export type ReminderRunResult = {
  created: number;
  windows: Array<{
    kind: ReminderWindow["kind"];
    lessonSessionNotifications: number;
    courseSessionNotifications: number;
    directBookingNotifications: number;
  }>;
};

const windows: ReminderWindow[] = [
  { kind: "lesson_reminder_24h", label: "24 saat", lowerMinutes: 23 * 60, upperMinutes: 25 * 60 },
  { kind: "lesson_reminder_2h", label: "2 saat", lowerMinutes: 90, upperMinutes: 150 },
];

async function createLessonSessionReminders(client: Queryable, w: ReminderWindow): Promise<number> {
  const r = await client.query(
    `with due as (
       select ls.id,
              ls.session_index,
              ls.scheduled_start,
              ls.meeting_url,
              lp.student_id,
              lp.request_kind,
              st.user_id as student_user_id,
              su.display_name as student_display_name,
              tt.user_id as teacher_user_id,
              tu.display_name as teacher_display_name
       from lesson_sessions ls
       join lesson_packages lp on lp.id = ls.package_id
       join students st on st.id = lp.student_id
       join users su on su.id = st.user_id
       join teachers tt on tt.id = lp.teacher_id
       join users tu on tu.id = tt.user_id
       where ls.status = 'scheduled'
         and ls.scheduled_start is not null
         and ls.scheduled_start >= now() + ($2::int * interval '1 minute')
         and ls.scheduled_start < now() + ($3::int * interval '1 minute')
     ),
     recipients as (
       select d.*,
              d.student_user_id as recipient_user_id,
              'student' as recipient_kind
       from due d
       union all
       select d.*,
              sg.guardian_user_id as recipient_user_id,
              'guardian' as recipient_kind
       from due d
       join student_guardians sg on sg.student_id = d.student_id
       union all
       select d.*,
              d.teacher_user_id as recipient_user_id,
              'teacher' as recipient_kind
       from due d
     ),
     ins as (
       insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at,
         dedupe_key, reminder_kind, scheduled_for
       )
       select r.recipient_user_id,
              r.student_id,
              null,
              'in_app',
              case
                when $1 = 'lesson_reminder_24h' then 'Ders hatırlatması: 24 saat kaldı'
                else 'Ders hatırlatması: 2 saat kaldı'
              end,
              concat(
                case when r.request_kind = 'demo' then 'Demo ders' else 'Ders' end,
                ' #', r.session_index,
                ' ', $4::text, ' sonra başlıyor. Sınıf linki panelinizde hazır.'
              ),
              jsonb_build_object(
                'kind', $1,
                'lessonSessionId', r.id,
                'studentId', r.student_id,
                'scheduledStart', r.scheduled_start,
                'meetingUrl', r.meeting_url,
                'classroomHref', concat('/classroom/lesson/', r.id),
                'href', concat('/classroom/lesson/', r.id),
                'priority', case when $1 = 'lesson_reminder_2h' then 'urgent' else 'high' end,
                'actionLabel', 'Derse git',
                'recipientKind', r.recipient_kind
              ),
              'sent',
              now(),
              concat($1, ':lesson_session:', r.id::text, ':', r.recipient_user_id::text),
              $1,
              r.scheduled_start
       from recipients r
       on conflict (dedupe_key) where dedupe_key is not null do nothing
       returning 1
     )
     select count(*)::int as created from ins`,
    [w.kind, w.lowerMinutes, w.upperMinutes, w.label],
  );
  return Number(r.rows[0]?.created ?? 0);
}

async function createCourseSessionReminders(client: Queryable, w: ReminderWindow): Promise<number> {
  const r = await client.query(
    `with due as (
       select cs.id,
              cs.session_index,
              coalesce(cs.title, c.title) as session_title,
              c.title as course_title,
              cs.scheduled_start,
              cs.meeting_url,
              t.user_id as teacher_user_id
       from course_sessions cs
       join course_cohorts cc on cc.id = cs.cohort_id
       join courses c on c.id = cc.course_id
       join teachers t on t.id = c.teacher_id
       where cs.status = 'scheduled'
         and cs.scheduled_start is not null
         and cs.scheduled_start >= now() + ($2::int * interval '1 minute')
         and cs.scheduled_start < now() + ($3::int * interval '1 minute')
     ),
     student_recipients as (
       select d.*,
              ce.student_id,
              st.user_id as recipient_user_id,
              'student' as recipient_kind
       from due d
       join course_sessions cs on cs.id = d.id
       join course_enrollments ce on ce.cohort_id = cs.cohort_id
       join students st on st.id = ce.student_id
     ),
     recipients as (
       select * from student_recipients
       union all
       select sr.id,
              sr.session_index,
              sr.session_title,
              sr.course_title,
              sr.scheduled_start,
              sr.meeting_url,
              sr.teacher_user_id,
              sr.student_id,
              sg.guardian_user_id as recipient_user_id,
              'guardian' as recipient_kind
       from student_recipients sr
       join student_guardians sg on sg.student_id = sr.student_id
       union all
       select d.id,
              d.session_index,
              d.session_title,
              d.course_title,
              d.scheduled_start,
              d.meeting_url,
              d.teacher_user_id,
              null::uuid as student_id,
              d.teacher_user_id as recipient_user_id,
              'teacher' as recipient_kind
       from due d
     ),
     ins as (
       insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at,
         dedupe_key, reminder_kind, scheduled_for
       )
       select r.recipient_user_id,
              r.student_id,
              null,
              'in_app',
              case
                when $1 = 'lesson_reminder_24h' then 'Kurs dersi hatırlatması: 24 saat kaldı'
                else 'Kurs dersi hatırlatması: 2 saat kaldı'
              end,
              concat(r.course_title, ' dersi ', $4::text, ' sonra başlıyor. Sınıf linki panelinizde hazır.'),
              jsonb_build_object(
                'kind', replace($1, 'lesson_', 'course_session_'),
                'courseSessionId', r.id,
                'studentId', r.student_id,
                'scheduledStart', r.scheduled_start,
                'meetingUrl', r.meeting_url,
                'classroomHref', concat('/classroom/course/', r.id),
                'href', concat('/classroom/course/', r.id),
                'priority', case when $1 = 'lesson_reminder_2h' then 'urgent' else 'high' end,
                'actionLabel', 'Derse git',
                'recipientKind', r.recipient_kind
              ),
              'sent',
              now(),
              concat($1, ':course_session:', r.id::text, ':', r.recipient_user_id::text),
              $1,
              r.scheduled_start
       from recipients r
       on conflict (dedupe_key) where dedupe_key is not null do nothing
       returning 1
     )
     select count(*)::int as created from ins`,
    [w.kind, w.lowerMinutes, w.upperMinutes, w.label],
  );
  return Number(r.rows[0]?.created ?? 0);
}

async function createDirectBookingReminders(client: Queryable, w: ReminderWindow): Promise<number> {
  try {
    const r = await client.query<{
      recipient_user_id: string;
      scheduled_start: string;
      meeting_url: string | null;
    }>(
      `with due as (
         select b.id,
                b.scheduled_start,
                b.meeting_url,
                b.student_id,
                st.user_id as student_user_id,
                tt.user_id as teacher_user_id
         from direct_lesson_bookings b
         join students st on st.id = b.student_id
         join teachers tt on tt.id = b.teacher_id
         where b.status = 'funded'
           and b.scheduled_start is not null
           and b.scheduled_start >= now() + ($2::int * interval '1 minute')
           and b.scheduled_start < now() + ($3::int * interval '1 minute')
       ),
       recipients as (
         select d.id, d.scheduled_start, d.meeting_url, d.student_id, d.student_user_id as recipient_user_id from due d
         union all
         select d.id, d.scheduled_start, d.meeting_url, d.student_id, sg.guardian_user_id
         from due d
         join student_guardians sg on sg.student_id = d.student_id
         union all
         select d.id, d.scheduled_start, d.meeting_url, d.student_id, d.teacher_user_id from due d
       ),
       ins as (
         insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at,
           dedupe_key, reminder_kind, scheduled_for
         )
         select r.recipient_user_id,
                r.student_id,
                null,
                'in_app',
                case when $1 = 'lesson_reminder_24h' then 'Doğrudan ders hatırlatması: 24 saat kaldı'
                     else 'Doğrudan ders hatırlatması: 2 saat kaldı' end,
                concat('Doğrudan ders ', $4::text, ' sonra başlıyor.'),
                jsonb_build_object(
                  'kind', 'direct_booking_reminder',
                  'directBookingId', r.id,
                  'scheduledStart', r.scheduled_start,
                  'meetingUrl', r.meeting_url,
                  'href', '/student/dogrudan-dersler',
                  'priority', case when $1 = 'lesson_reminder_2h' then 'urgent' else 'high' end,
                  'actionLabel', 'Rezervasyon'
                ),
                'sent',
                now(),
                concat($1, ':direct_booking:', r.id::text, ':', r.recipient_user_id::text),
                $1,
                r.scheduled_start
         from recipients r
         on conflict (dedupe_key) where dedupe_key is not null do nothing
         returning recipient_user_id, scheduled_for as scheduled_start,
                   (payload_jsonb->>'meetingUrl') as meeting_url
       )
       select * from ins`,
      [w.kind, w.lowerMinutes, w.upperMinutes, w.label],
    );

    for (const row of r.rows) {
      const when = row.scheduled_start
        ? new Date(row.scheduled_start).toLocaleString("tr-TR")
        : w.label;
      const body = `Doğrudan dersiniz ${when} tarihinde başlıyor.${row.meeting_url ? ` Link: ${row.meeting_url}` : ""}`;
      await queueUserEmail({
        userId: row.recipient_user_id,
        templateKey: `lesson_${w.kind}`,
        subject: w.kind === "lesson_reminder_24h" ? "Ders hatırlatması (24 saat)" : "Ders hatırlatması (2 saat)",
        bodyText: body,
      }, client as typeof pool);
      await queueUserSms({
        userId: row.recipient_user_id,
        templateKey: `lesson_${w.kind}`,
        bodyText: body.slice(0, 160),
      }, client as typeof pool);
    }

    return r.rowCount ?? 0;
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return 0;
    throw e;
  }
}

export async function runLessonReminderJob(client: Queryable = pool): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { created: 0, windows: [] };
  for (const w of windows) {
    const lessonSessionNotifications = await createLessonSessionReminders(client, w);
    const courseSessionNotifications = await createCourseSessionReminders(client, w);
    const directBookingNotifications = await createDirectBookingReminders(client, w);
    result.created += lessonSessionNotifications + courseSessionNotifications + directBookingNotifications;
    result.windows.push({
      kind: w.kind,
      lessonSessionNotifications,
      courseSessionNotifications,
      directBookingNotifications,
    });
  }
  return result;
}
