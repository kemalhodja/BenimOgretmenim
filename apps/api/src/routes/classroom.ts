import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { verifyAccessToken } from "../auth/jwt.js";
import { settleCourseEnrollmentHold } from "../lib/courseEnrollmentWallet.js";
import { settleCourseSessionTeacherPayout } from "../lib/courseTeacherPayout.js";

export const classroom = new Hono<{ Variables: AppVariables }>();

function meetingBase(): string {
  return (process.env.MEETING_BASE_URL ?? "https://meet.jit.si").replace(/\/$/, "");
}

const noteSchema = z.object({
  body: z.string().max(4000).optional().nullable(),
  whiteboard: z
    .object({
      imageDataUrl: z.string().max(700_000).optional(),
      strokes: z.array(z.unknown()).max(5000).optional(),
      exportedAt: z.string().datetime().optional(),
    })
    .optional()
    .nullable(),
});

const attendanceSchema = z.object({
  eventType: z.enum(["join", "leave", "heartbeat"]),
  clientMeta: z.record(z.string(), z.unknown()).optional().default({}),
});

const whiteboardStateSchema = z.object({
  whiteboard: z.object({
    imageDataUrl: z.string().max(700_000).optional(),
    strokes: z.array(z.unknown()).max(5000).optional(),
    updatedAtClient: z.string().datetime().optional(),
  }),
});

const materialSchema = z.object({
  title: z.string().min(2).max(180),
  materialType: z.enum(["link", "image", "pdf", "video", "note"]).optional().default("link"),
  url: z.string().url().max(2000).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const recordingSchema = z.object({
  title: z.string().min(2).max(180),
  url: z.string().url().max(2000),
  status: z.enum(["processing", "ready", "failed", "deleted"]).optional().default("ready"),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).optional().nullable(),
  bytes: z.number().int().min(0).optional().nullable(),
  checksumSha256: z.string().min(32).max(128).optional().nullable(),
  consentSnapshot: z.record(z.string(), z.unknown()).optional().default({}),
});

const messageSchema = z.object({
  body: z.string().min(1).max(1200),
  messageType: z.enum(["chat", "question", "answer", "announcement"]).optional().default("chat"),
});

type AccessResult = {
  subjectType: "lesson_session" | "course_session";
  subjectId: string;
  room: Record<string, unknown>;
  canManageRecordings: boolean;
};

async function guardianCanSeeStudent(userId: string, studentId: string): Promise<boolean> {
  const r = await pool.query(
    `select 1 from student_guardians where guardian_user_id = $1 and student_id = $2`,
    [userId, studentId],
  );
  return (r.rowCount ?? 0) > 0;
}

async function resolveLessonAccess(sessionId: string, userId: string, role: string): Promise<AccessResult | null> {
  const r = await pool.query(
    `select ls.id,
            ls.session_index,
            ls.scheduled_start,
            ls.scheduled_end,
            ls.duration_minutes,
            ls.status,
            ls.meeting_url,
            lp.id as package_id,
            lp.student_id,
            lp.teacher_id,
            su.display_name as student_display_name,
            tu.display_name as teacher_display_name,
            s.user_id as student_user_id,
            t.user_id as teacher_user_id
     from lesson_sessions ls
     join lesson_packages lp on lp.id = ls.package_id
     join students s on s.id = lp.student_id
     join users su on su.id = s.user_id
     join teachers t on t.id = lp.teacher_id
     join users tu on tu.id = t.user_id
     where ls.id = $1`,
    [sessionId],
  );
  if (!r.rowCount) return null;
  const row = r.rows[0] as {
    id: string;
    session_index: number;
    scheduled_start: string | null;
    scheduled_end: string | null;
    duration_minutes: number | null;
    status: string;
    meeting_url: string | null;
    package_id: string;
    student_id: string;
    teacher_id: string;
    student_display_name: string;
    teacher_display_name: string;
    student_user_id: string;
    teacher_user_id: string;
  };

  const allowed =
    role === "admin" ||
    row.student_user_id === userId ||
    row.teacher_user_id === userId ||
    (role === "guardian" && (await guardianCanSeeStudent(userId, row.student_id)));
  if (!allowed) return null;

  return {
    subjectType: "lesson_session",
    subjectId: row.id,
    canManageRecordings: role === "admin" || row.teacher_user_id === userId,
    room: {
      kind: "lesson",
      sessionId: row.id,
      title: `Ders #${row.session_index}`,
      status: row.status,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      durationMinutes: row.duration_minutes,
      meetingUrl: row.meeting_url ?? `${meetingBase()}/bm-${row.id}`,
      provider: "jitsi",
      canManageRecordings: role === "admin" || row.teacher_user_id === userId,
      packageId: row.package_id,
      teacher: { id: row.teacher_id, displayName: row.teacher_display_name },
      participants: [
        { role: "teacher", displayName: row.teacher_display_name },
        { role: "student", displayName: row.student_display_name },
      ],
    },
  };
}

async function resolveCourseAccess(sessionId: string, userId: string, role: string): Promise<AccessResult | null> {
  const r = await pool.query(
    `select cs.id,
            cs.session_index,
            cs.title,
            cs.scheduled_start,
            cs.scheduled_end,
            cs.duration_minutes,
            cs.status,
            cs.meeting_url,
            cc.id as cohort_id,
            cc.title as cohort_title,
            c.id as course_id,
            c.title as course_title,
            c.teacher_id,
            t.user_id as teacher_user_id,
            tu.display_name as teacher_display_name
     from course_sessions cs
     join course_cohorts cc on cc.id = cs.cohort_id
     join courses c on c.id = cc.course_id
     join teachers t on t.id = c.teacher_id
     join users tu on tu.id = t.user_id
     where cs.id = $1`,
    [sessionId],
  );
  if (!r.rowCount) return null;
  const row = r.rows[0] as {
    id: string;
    session_index: number;
    title: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    duration_minutes: number | null;
    status: string;
    meeting_url: string | null;
    cohort_id: string;
    cohort_title: string;
    course_id: string;
    course_title: string;
    teacher_id: string;
    teacher_user_id: string;
    teacher_display_name: string;
  };

  let allowed = role === "admin" || row.teacher_user_id === userId;
  let studentIdForGuardian: string | null = null;
  let enrollmentForAccess: { id: string; payment_status: string } | null = null;
  if (!allowed && role === "student") {
    const sr = await pool.query(`select id from students where user_id = $1`, [userId]);
    const studentId = sr.rows[0]?.id as string | undefined;
    if (studentId) {
      const en = await pool.query<{ id: string; payment_status: string }>(
        `select id, payment_status
         from course_enrollments
         where cohort_id = $1
           and student_id = $2
           and payment_status not in ('cancelled', 'refunded')`,
        [row.cohort_id, studentId],
      );
      allowed = (en.rowCount ?? 0) > 0;
      enrollmentForAccess = en.rows[0] ?? null;
    }
  }
  if (!allowed && role === "guardian") {
    const gr = await pool.query(
      `select ce.student_id
       from course_enrollments ce
       join student_guardians sg on sg.student_id = ce.student_id
       where ce.cohort_id = $1
         and sg.guardian_user_id = $2
         and ce.payment_status not in ('cancelled', 'refunded')
       limit 1`,
      [row.cohort_id, userId],
    );
    studentIdForGuardian = (gr.rows[0]?.student_id as string | undefined) ?? null;
    allowed = !!studentIdForGuardian;
  }
  if (!allowed) return null;

  if (
    enrollmentForAccess?.payment_status === "wallet_held" &&
    row.scheduled_start &&
    new Date(row.scheduled_start).getTime() <= Date.now()
  ) {
    await settleCourseEnrollmentHold(enrollmentForAccess.id);
  }
  if (row.scheduled_start && new Date(row.scheduled_start).getTime() <= Date.now()) {
    await settleCourseSessionTeacherPayout(row.id);
  }

  const participants = await pool.query(
    `select 'student' as role, u.display_name
     from course_enrollments ce
     join students s on s.id = ce.student_id
     join users u on u.id = s.user_id
     where ce.cohort_id = $1
       and ce.payment_status not in ('cancelled', 'refunded')
     order by u.display_name
     limit 80`,
    [row.cohort_id],
  );

  return {
    subjectType: "course_session",
    subjectId: row.id,
    canManageRecordings: role === "admin" || row.teacher_user_id === userId,
    room: {
      kind: "course",
      sessionId: row.id,
      title: row.title || `${row.course_title} #${row.session_index}`,
      status: row.status,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      durationMinutes: row.duration_minutes,
      meetingUrl: row.meeting_url ?? `${meetingBase()}/bm-course-${row.id}`,
      provider: "jitsi",
      canManageRecordings: role === "admin" || row.teacher_user_id === userId,
      courseId: row.course_id,
      cohortId: row.cohort_id,
      cohortTitle: row.cohort_title,
      teacher: { id: row.teacher_id, displayName: row.teacher_display_name },
      participants: [
        { role: "teacher", displayName: row.teacher_display_name },
        ...participants.rows.map((p) => ({
          role: p.role as string,
          displayName: p.display_name as string,
        })),
      ],
    },
  };
}

async function resolveAccess(kind: "lesson-sessions" | "course-sessions", sessionId: string, userId: string, role: string) {
  if (!z.string().uuid().safeParse(sessionId).success) return null;
  if (kind === "lesson-sessions") return resolveLessonAccess(sessionId, userId, role);
  return resolveCourseAccess(sessionId, userId, role);
}

async function loadNotes(subjectType: string, subjectId: string) {
  const notes = await pool.query(
    `select n.id,
            n.body,
            n.whiteboard_jsonb,
            n.created_at,
            u.display_name as author_display_name
     from classroom_session_notes n
     left join users u on u.id = n.author_user_id
     where n.subject_type = $1 and n.subject_id = $2
     order by n.created_at desc
     limit 30`,
    [subjectType, subjectId],
  );
  return notes.rows;
}

async function loadWhiteboardState(subjectType: string, subjectId: string) {
  const r = await pool.query(
    `select w.whiteboard_jsonb,
            w.updated_at,
            u.display_name as updated_by_display_name
     from classroom_whiteboard_states w
     left join users u on u.id = w.updated_by_user_id
     where w.subject_type = $1 and w.subject_id = $2`,
    [subjectType, subjectId],
  );
  return r.rows[0] ?? null;
}

async function loadMaterials(subjectType: string, subjectId: string) {
  const r = await pool.query(
    `select m.id,
            m.title,
            m.material_type,
            m.url,
            m.description,
            m.metadata_jsonb,
            m.created_at,
            u.display_name as uploaded_by_display_name
     from classroom_materials m
     left join users u on u.id = m.uploaded_by_user_id
     where m.subject_type = $1 and m.subject_id = $2
     order by m.created_at desc
     limit 40`,
    [subjectType, subjectId],
  );
  return r.rows;
}

async function loadRecordings(subjectType: string, subjectId: string) {
  const r = await pool.query(
    `select ra.id,
            ra.status::text as status,
            coalesce(ra.title, 'Ders kaydı') as title,
            coalesce(ra.public_url, case when ra.storage_bucket = 'external_url' then ra.storage_object_key else null end) as public_url,
            ra.duration_seconds,
            ra.bytes::text as bytes,
            ra.created_at,
            u.display_name as created_by_display_name
     from recording_assets ra
     left join classroom_sessions cs on cs.id = ra.classroom_session_id
     left join users u on u.id = ra.created_by_user_id
     where (ra.subject_type = $1 and ra.subject_id = $2)
        or ($1 = 'lesson_session' and cs.lesson_session_id = $2)
     order by ra.created_at desc
     limit 20`,
    [subjectType, subjectId],
  );
  return r.rows;
}

async function loadMessages(subjectType: string, subjectId: string) {
  const r = await pool.query(
    `select id,
            author_role,
            author_display_name,
            message_type,
            body,
            created_at
     from (
       select id, author_role, author_display_name, message_type, body, created_at
       from classroom_messages
       where subject_type = $1 and subject_id = $2 and deleted_at is null
       order by created_at desc
       limit 80
     ) recent
     order by created_at asc`,
    [subjectType, subjectId],
  );
  return r.rows;
}

function encodeSse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function ensureLessonClassroomSession(lessonSessionId: string): Promise<string> {
  const r = await pool.query(
    `insert into classroom_sessions (lesson_session_id, provider, status, metadata_jsonb)
     values ($1, 'external_meeting', 'ended', '{}'::jsonb)
     on conflict (lesson_session_id) do update
       set updated_at = now()
     returning id`,
    [lessonSessionId],
  );
  return String(r.rows[0].id);
}

classroom.get("/:kind/:sessionId", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);
  const notes = await loadNotes(access.subjectType, access.subjectId);
  const attendance = await loadAttendance(access.subjectType, access.subjectId);
  const whiteboardState = await loadWhiteboardState(access.subjectType, access.subjectId);
  const materials = await loadMaterials(access.subjectType, access.subjectId);
  const recordings = await loadRecordings(access.subjectType, access.subjectId);
  const messages = await loadMessages(access.subjectType, access.subjectId);
  return c.json({ room: access.room, notes, attendance, whiteboardState, materials, recordings, messages });
});

classroom.get("/:kind/:sessionId/events", async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const tokenFromQuery = c.req.query("token")?.trim();
  const bearer = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const token = tokenFromQuery || bearer;
  if (!token) return c.json({ error: "missing_bearer_token" }, 401);

  let userId: string;
  let role: string;
  try {
    const payload = await verifyAccessToken(token);
    userId = payload.userId;
    role = payload.role;
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }

  const access = await resolveAccess(kind, c.req.param("sessionId"), userId, role);
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);
  const liveAccess = access;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      async function pushSnapshot() {
        if (closed) return;
        try {
          const [attendance, messages, whiteboardState] = await Promise.all([
            loadAttendance(liveAccess.subjectType, liveAccess.subjectId),
            loadMessages(liveAccess.subjectType, liveAccess.subjectId),
            loadWhiteboardState(liveAccess.subjectType, liveAccess.subjectId),
          ]);
          controller.enqueue(
            encodeSse("snapshot", {
              attendance,
              messages,
              whiteboardState,
              serverTime: new Date().toISOString(),
            }),
          );
        } catch (e) {
          controller.enqueue(
            encodeSse("error", {
              error: e instanceof Error ? e.message : "classroom_stream_failed",
            }),
          );
        }
      }

      controller.enqueue(encodeSse("ready", { room: liveAccess.room, serverTime: new Date().toISOString() }));
      await pushSnapshot();
      const id = setInterval(() => {
        void pushSnapshot();
      }, 3_000);
      const abort = () => {
        closed = true;
        clearInterval(id);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      c.req.raw.signal.addEventListener("abort", abort, { once: true });
    },
    cancel() {
      /* client closed */
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
});

classroom.post("/:kind/:sessionId/notes", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);

  const parsed = noteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data.body?.trim() || null;
  const whiteboard = parsed.data.whiteboard ?? null;
  if (!body && !whiteboard) return c.json({ error: "empty_classroom_note" }, 400);

  const ins = await pool.query(
    `insert into classroom_session_notes (
       subject_type, subject_id, author_user_id, body, whiteboard_jsonb
     ) values ($1, $2, $3, $4, $5::jsonb)
     returning id, body, whiteboard_jsonb, created_at`,
    [
      access.subjectType,
      access.subjectId,
      c.get("userId"),
      body,
      JSON.stringify(whiteboard ?? {}),
    ],
  );
  return c.json({ note: ins.rows[0] }, 201);
});

async function loadAttendance(subjectType: string, subjectId: string) {
  const r = await pool.query(
    `with latest as (
       select distinct on (user_id)
              user_id,
              role,
              display_name_snapshot,
              event_type,
              created_at
       from classroom_attendance_events
       where subject_type = $1 and subject_id = $2 and user_id is not null
       order by user_id, created_at desc
     )
     select role,
            display_name_snapshot,
            event_type,
            created_at,
            case
              when event_type in ('join', 'heartbeat')
               and created_at > now() - interval '90 seconds'
              then true
              else false
            end as online
     from latest
     order by online desc, display_name_snapshot nulls last`,
    [subjectType, subjectId],
  );
  return r.rows;
}

classroom.post("/:kind/:sessionId/attendance", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);

  const parsed = attendanceSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const user = await pool.query(`select display_name, role::text as role from users where id = $1`, [
    c.get("userId"),
  ]);
  const displayName =
    typeof user.rows[0]?.display_name === "string" ? (user.rows[0].display_name as string) : null;
  const role = typeof user.rows[0]?.role === "string" ? (user.rows[0].role as string) : c.get("userRole");

  await pool.query(
    `insert into classroom_attendance_events (
       subject_type, subject_id, user_id, role, display_name_snapshot,
       event_type, client_meta_jsonb
     ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      access.subjectType,
      access.subjectId,
      c.get("userId"),
      role,
      displayName,
      parsed.data.eventType,
      JSON.stringify(parsed.data.clientMeta ?? {}),
    ],
  );

  const attendance = await loadAttendance(access.subjectType, access.subjectId);
  return c.json({ ok: true, attendance });
});

classroom.post("/:kind/:sessionId/whiteboard", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);

  const parsed = whiteboardStateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const r = await pool.query(
    `insert into classroom_whiteboard_states (
       subject_type, subject_id, updated_by_user_id, whiteboard_jsonb, updated_at
     ) values ($1, $2, $3, $4::jsonb, now())
     on conflict (subject_type, subject_id) do update
       set updated_by_user_id = excluded.updated_by_user_id,
           whiteboard_jsonb = excluded.whiteboard_jsonb,
           updated_at = now()
     returning whiteboard_jsonb, updated_at`,
    [
      access.subjectType,
      access.subjectId,
      c.get("userId"),
      JSON.stringify(parsed.data.whiteboard),
    ],
  );
  return c.json({ whiteboardState: r.rows[0] });
});

classroom.post("/:kind/:sessionId/materials", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);

  const parsed = materialSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const ins = await pool.query(
    `insert into classroom_materials (
       subject_type, subject_id, uploaded_by_user_id, title,
       material_type, url, description, metadata_jsonb
     ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     returning id, title, material_type, url, description, metadata_jsonb, created_at`,
    [
      access.subjectType,
      access.subjectId,
      c.get("userId"),
      parsed.data.title.trim(),
      parsed.data.materialType,
      parsed.data.url?.trim() || null,
      parsed.data.description?.trim() || null,
      JSON.stringify(parsed.data.metadata ?? {}),
    ],
  );
  return c.json({ material: ins.rows[0] }, 201);
});

classroom.post("/:kind/:sessionId/recordings", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);
  if (!access.canManageRecordings) return c.json({ error: "recording_manage_forbidden" }, 403);

  const parsed = recordingSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const classroomSessionId =
    access.subjectType === "lesson_session" ? await ensureLessonClassroomSession(access.subjectId) : null;
  const url = parsed.data.url.trim();
  const ins = await pool.query(
    `insert into recording_assets (
       classroom_session_id, status, storage_bucket, storage_object_key,
       bytes, duration_seconds, checksum_sha256, consent_snapshot_jsonb,
       subject_type, subject_id, title, public_url, created_by_user_id
     ) values (
       $1, $2::recording_asset_status, 'external_url', $3,
       $4, $5, $6, $7::jsonb,
       $8, $9, $10, $11, $12
     )
     on conflict (classroom_session_id, storage_object_key) do update
       set status = excluded.status,
           title = excluded.title,
           public_url = excluded.public_url,
           duration_seconds = excluded.duration_seconds,
           bytes = excluded.bytes,
           checksum_sha256 = excluded.checksum_sha256,
           consent_snapshot_jsonb = excluded.consent_snapshot_jsonb,
           subject_type = excluded.subject_type,
           subject_id = excluded.subject_id,
           created_by_user_id = excluded.created_by_user_id
     returning id, status::text as status, title, public_url, duration_seconds, bytes::text as bytes, created_at`,
    [
      classroomSessionId,
      parsed.data.status,
      url,
      parsed.data.bytes ?? null,
      parsed.data.durationSeconds ?? null,
      parsed.data.checksumSha256?.trim() || null,
      JSON.stringify(parsed.data.consentSnapshot ?? {}),
      access.subjectType,
      access.subjectId,
      parsed.data.title.trim(),
      url,
      c.get("userId"),
    ],
  );
  return c.json({ recording: ins.rows[0] }, 201);
});

classroom.get("/:kind/:sessionId/messages", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);
  const messages = await loadMessages(access.subjectType, access.subjectId);
  return c.json({ messages });
});

classroom.post("/:kind/:sessionId/messages", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (kind !== "lesson-sessions" && kind !== "course-sessions") {
    return c.json({ error: "invalid_classroom_kind" }, 400);
  }
  const access = await resolveAccess(kind, c.req.param("sessionId"), c.get("userId"), c.get("userRole"));
  if (!access) return c.json({ error: "not_found_or_forbidden" }, 404);

  const parsed = messageSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data.body.trim();
  if (!body) return c.json({ error: "empty_classroom_message" }, 400);
  if (parsed.data.messageType === "announcement" && !access.canManageRecordings) {
    return c.json({ error: "announcement_forbidden" }, 403);
  }

  const user = await pool.query(`select display_name, role::text as role from users where id = $1`, [
    c.get("userId"),
  ]);
  const displayName =
    typeof user.rows[0]?.display_name === "string" ? (user.rows[0].display_name as string) : null;
  const role = typeof user.rows[0]?.role === "string" ? (user.rows[0].role as string) : c.get("userRole");

  const ins = await pool.query(
    `insert into classroom_messages (
       subject_type, subject_id, author_user_id, author_role,
       author_display_name, message_type, body
     ) values ($1, $2, $3, $4, $5, $6, $7)
     returning id, author_role, author_display_name, message_type, body, created_at`,
    [
      access.subjectType,
      access.subjectId,
      c.get("userId"),
      role,
      displayName,
      parsed.data.messageType,
      body,
    ],
  );
  return c.json({ message: ins.rows[0] }, 201);
});
