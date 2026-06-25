import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { loadCurriculumOutcomes } from "../lib/lessonVideoCatalog.js";
import {
  parseWeakTopicTokens,
  rankVideosForWeakTopics,
  type ScorableVideo,
} from "../lib/lessonVideoSuggestions.js";

export const lessonVideos = new Hono<{ Variables: AppVariables }>();

const videoKindSchema = z.enum(["lesson", "exam_prep"]);

const ALLOWED_VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];

function isAllowedVideoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_VIDEO_HOSTS.some((h) => host.includes(h));
  } catch {
    return false;
  }
}

const createSchema = z.object({
  gradeLevel: z.number().int().min(1).max(12),
  branchId: z.number().int().positive(),
  topicTitle: z.string().min(2).max(160),
  outcomeCode: z.string().min(2).max(40),
  outcomeTitle: z.string().min(2).max(240),
  title: z.string().min(3).max(160),
  description: z.string().max(2000).optional().nullable(),
  videoUrl: z
    .string()
    .url()
    .max(2000)
    .refine((u) => u.startsWith("https://"), { message: "video_url_must_be_https" })
    .refine(isAllowedVideoUrl, { message: "video_host_not_allowed" }),
  videoKind: videoKindSchema.optional().default("lesson"),
  durationMinutes: z.number().int().min(1).max(600).optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("published"),
});

const patchSchema = createSchema.partial();

lessonVideos.use(
  "/",
  rateLimit({
    name: "lesson_videos_write",
    limit: 30,
    windowMs: 60_000,
    skip: (c) => c.req.method === "GET",
  }),
);

async function teacherIdForUser(userId: string): Promise<string | null> {
  const r = await pool.query(`select id from teachers where user_id = $1`, [userId]);
  return (r.rows[0]?.id as string | undefined) ?? null;
}

async function studentProfileForUser(
  userId: string,
): Promise<{ studentId: string; gradeLevel: number | null } | null> {
  const r = await pool.query(`select id, grade_level from students where user_id = $1`, [userId]);
  const row = r.rows[0] as { id: string; grade_level: number | null } | undefined;
  if (!row) return null;
  return { studentId: row.id, gradeLevel: row.grade_level != null ? Number(row.grade_level) : null };
}

async function teacherTeachesBranch(teacherId: string, branchId: number): Promise<boolean> {
  const r = await pool.query(
    `select 1 from teacher_branches where teacher_id = $1 and branch_id = $2 limit 1`,
    [teacherId, branchId],
  );
  return (r.rowCount ?? 0) > 0;
}

function mapVideoRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherDisplayName: row.teacher_display_name,
    gradeLevel: Number(row.grade_level),
    branchId: Number(row.branch_id),
    branchName: row.branch_name,
    branchSlug: row.branch_slug,
    topicTitle: row.topic_title,
    outcomeCode: row.outcome_code,
    outcomeTitle: row.outcome_title,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url,
    videoKind: row.video_kind,
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    status: row.status,
    moderationStatus: row.moderation_status ?? "approved",
    moderationNote: row.moderation_note ?? null,
    viewCount: row.view_count != null ? Number(row.view_count) : 0,
    uniqueViewerCount: row.unique_viewer_count != null ? Number(row.unique_viewer_count) : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const videoSelectSql = `
  select v.id, v.teacher_id, u.display_name as teacher_display_name,
         v.grade_level, v.branch_id, b.name as branch_name, b.slug as branch_slug,
         v.topic_title, v.outcome_code, v.outcome_title,
         v.title, v.description, v.video_url, v.video_kind, v.duration_minutes,
         v.status, v.moderation_status, v.moderation_note, v.created_at, v.updated_at,
         coalesce(vc.total_watches, 0)::int as view_count,
         coalesce(vc.unique_viewers, 0)::int as unique_viewer_count
  from teacher_lesson_videos v
  join teachers t on t.id = v.teacher_id
  join users u on u.id = t.user_id
  join branches b on b.id = v.branch_id
  left join lateral (
    select sum(lvv.watch_count)::int as total_watches,
           count(*)::int as unique_viewers
    from lesson_video_views lvv
    where lvv.video_id = v.id
  ) vc on true`;

async function loadFacets(gradeLevel: number) {
  const r = await pool.query<{
    branch_id: number;
    branch_name: string;
    branch_slug: string;
    video_kind: string;
    count: string;
  }>(
    `select v.branch_id, b.name as branch_name, b.slug as branch_slug,
            v.video_kind, count(*)::text as count
     from teacher_lesson_videos v
     join branches b on b.id = v.branch_id
     where v.grade_level = $1 and v.status = 'published' and v.moderation_status = 'approved'
     group by v.branch_id, b.name, b.slug, v.video_kind
     order by b.name, v.video_kind`,
    [gradeLevel],
  );

  const byBranch = new Map<
    number,
    { branchId: number; branchName: string; branchSlug: string; total: number; lesson: number; examPrep: number }
  >();
  let lessonTotal = 0;
  let examPrepTotal = 0;

  for (const row of r.rows) {
    const count = Number(row.count);
    const entry = byBranch.get(row.branch_id) ?? {
      branchId: row.branch_id,
      branchName: row.branch_name,
      branchSlug: row.branch_slug,
      total: 0,
      lesson: 0,
      examPrep: 0,
    };
    entry.total += count;
    if (row.video_kind === "exam_prep") {
      entry.examPrep += count;
      examPrepTotal += count;
    } else {
      entry.lesson += count;
      lessonTotal += count;
    }
    byBranch.set(row.branch_id, entry);
  }

  return {
    total: lessonTotal + examPrepTotal,
    lesson: lessonTotal,
    examPrep: examPrepTotal,
    branches: [...byBranch.values()],
  };
}

async function queryApprovedVideos(args: {
  gradeLevel: number;
  branchId?: number | null;
  videoKind?: string | null;
  topic?: string | null;
  teacherId?: string | null;
  limit?: number;
}) {
  const qArgs: unknown[] = [args.gradeLevel];
  const filters = [`v.grade_level = $1`, `v.status = 'published'`, `v.moderation_status = 'approved'`];

  if (args.branchId) {
    qArgs.push(args.branchId);
    filters.push(`v.branch_id = $${qArgs.length}`);
  }
  if (args.videoKind) {
    qArgs.push(args.videoKind);
    filters.push(`v.video_kind = $${qArgs.length}`);
  }
  if (args.topic) {
    qArgs.push(`%${args.topic}%`);
    filters.push(
      `(v.topic_title ilike $${qArgs.length} or v.outcome_title ilike $${qArgs.length} or v.title ilike $${qArgs.length} or v.outcome_code ilike $${qArgs.length})`,
    );
  }
  if (args.teacherId) {
    qArgs.push(args.teacherId);
    filters.push(`v.teacher_id = $${qArgs.length}`);
  }

  const r = await pool.query(
    `${videoSelectSql}
     where ${filters.join(" and ")}
     order by v.video_kind, b.name, v.topic_title, v.created_at desc
     limit ${args.limit ?? 80}`,
    qArgs,
  );
  return r.rows.map((row) => mapVideoRow(row));
}

export async function suggestVideosForWeakTopics(args: {
  gradeLevel: number;
  topics: string[];
  branchId?: number | null;
  limit?: number;
}) {
  const topics = args.topics;
  if (!topics.length) return [];

  const videos = await queryApprovedVideos({
    gradeLevel: args.gradeLevel,
    branchId: args.branchId ?? null,
    limit: 80,
  });

  return rankVideosForWeakTopics(videos as Array<ScorableVideo & (typeof videos)[number]>, topics, args.limit ?? 5);
}

async function guardianLinkedStudent(
  guardianUserId: string,
  studentId: string,
): Promise<{ studentId: string; gradeLevel: number | null; displayName: string } | null> {
  const r = await pool.query(
    `select s.id as student_id, s.grade_level, u.display_name
     from student_guardians sg
     join students s on s.id = sg.student_id
     join users u on u.id = s.user_id
     where sg.guardian_user_id = $1 and sg.student_id = $2`,
    [guardianUserId, studentId],
  );
  const row = r.rows[0] as { student_id: string; grade_level: number | null; display_name: string } | undefined;
  if (!row) return null;
  return {
    studentId: row.student_id,
    gradeLevel: row.grade_level != null ? Number(row.grade_level) : null,
    displayName: row.display_name,
  };
}

/** Öğrenci: kendi sınıfına uygun yayınlanmış videolar */
lessonVideos.get("/", requireAuth, async (c) => {
  if (c.get("userRole") !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const profile = await studentProfileForUser(c.get("userId"));
  if (!profile) return c.json({ error: "student_profile_missing" }, 400);

  const gradeLevel = profile.gradeLevel;
  if (!gradeLevel) {
    return c.json({
      error: "grade_level_required",
      message: "Sınıf seviyeniz tanımlı değil. Kayıt veya profil ayarlarından sınıfınızı seçin.",
      videos: [],
      facets: null,
      filters: { gradeLevel: null },
    });
  }

  const branchId = z.coerce.number().int().positive().optional().safeParse(c.req.query("branchId"));
  const videoKind = videoKindSchema.optional().safeParse(c.req.query("videoKind"));
  const topic = c.req.query("topic")?.trim().slice(0, 80) || null;

  const [videos, facets] = await Promise.all([
    queryApprovedVideos({
      gradeLevel,
      branchId: branchId.success ? branchId.data : null,
      videoKind: videoKind.success ? videoKind.data : null,
      topic,
    }),
    loadFacets(gradeLevel),
  ]);

  return c.json({
    videos,
    facets,
    filters: {
      gradeLevel,
      branchId: branchId.success ? (branchId.data ?? null) : null,
      videoKind: videoKind.success ? (videoKind.data ?? null) : null,
      topic,
    },
    studentGradeLevel: profile.gradeLevel,
  });
});

/** Öğretmen: kendi videoları */
lessonVideos.get("/mine", requireAuth, async (c) => {
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }
  const teacherId = await teacherIdForUser(c.get("userId"));
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);

  const r = await pool.query(
    `${videoSelectSql}
     where v.teacher_id = $1 and v.status <> 'archived'
     order by v.created_at desc
     limit 100`,
    [teacherId],
  );
  return c.json({ videos: r.rows.map((row) => mapVideoRow(row)) });
});

/** Öğretmen: profilindeki kazanım etiketlerinden öneri */
lessonVideos.get("/outcome-suggestions", requireAuth, async (c) => {
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }
  const teacherId = await teacherIdForUser(c.get("userId"));
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);

  const gradeLevel = z.coerce.number().int().min(1).max(12).optional().safeParse(c.req.query("gradeLevel"));
  const branchSlug = c.req.query("branchSlug")?.trim() || null;

  const args: unknown[] = [teacherId];
  const where = ["teacher_id = $1"];
  if (gradeLevel.success && gradeLevel.data) {
    args.push(gradeLevel.data);
    where.push(`grade_level = $${args.length}`);
  }
  if (branchSlug) {
    args.push(branchSlug);
    where.push(`branch_slug = $${args.length}`);
  }

  try {
    const r = await pool.query(
      `select outcome_title, branch_slug, grade_level, confidence
       from teacher_outcome_tags
       where ${where.join(" and ")}
       order by confidence desc, outcome_title asc
       limit 20`,
      args,
    );
    return c.json({
      suggestions: r.rows.map((row) => ({
        outcomeTitle: row.outcome_title,
        branchSlug: row.branch_slug,
        gradeLevel: row.grade_level != null ? Number(row.grade_level) : null,
        confidence: row.confidence != null ? Number(row.confidence) : null,
      })),
    });
  } catch {
    return c.json({ suggestions: [] });
  }
});

/** Öğretmen: müfredat kazanım kataloğu */
lessonVideos.get("/curriculum-outcomes", requireAuth, async (c) => {
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }

  const gradeLevel = z.coerce.number().int().min(1).max(12).safeParse(c.req.query("gradeLevel"));
  const branchSlug = c.req.query("branchSlug")?.trim();
  if (!gradeLevel.success || !branchSlug) {
    return c.json({ error: "grade_level_and_branch_slug_required" }, 400);
  }

  const topic = c.req.query("topic")?.trim().slice(0, 80) || null;
  const outcomes = await loadCurriculumOutcomes({
    gradeLevel: gradeLevel.data,
    branchSlug,
    topic,
  });
  return c.json({ outcomes, gradeLevel: gradeLevel.data, branchSlug });
});

/** Veli: bağlı öğrencinin sınıfına uygun videolar (salt okunur liste) */
lessonVideos.get("/for-guardian", requireAuth, async (c) => {
  if (c.get("userRole") !== "guardian") {
    return c.json({ error: "forbidden_guardians_only" }, 403);
  }

  const studentId = z.string().uuid().safeParse(c.req.query("studentId"));
  if (!studentId.success) return c.json({ error: "invalid_student_id" }, 400);

  const linked = await guardianLinkedStudent(c.get("userId"), studentId.data);
  if (!linked) return c.json({ error: "student_not_linked" }, 403);

  if (!linked.gradeLevel) {
    return c.json({
      error: "grade_level_required",
      message: "Öğrencinin sınıf seviyesi tanımlı değil.",
      videos: [],
      student: { id: linked.studentId, displayName: linked.displayName, gradeLevel: null },
    });
  }

  const branchId = z.coerce.number().int().positive().optional().safeParse(c.req.query("branchId"));
  const videoKind = videoKindSchema.optional().safeParse(c.req.query("videoKind"));
  const topic = c.req.query("topic")?.trim().slice(0, 80) || null;

  const videos = await queryApprovedVideos({
    gradeLevel: linked.gradeLevel,
    branchId: branchId.success ? branchId.data : null,
    videoKind: videoKind.success ? videoKind.data : null,
    topic,
  });

  return c.json({
    videos,
    student: {
      id: linked.studentId,
      displayName: linked.displayName,
      gradeLevel: linked.gradeLevel,
    },
    filters: {
      gradeLevel: linked.gradeLevel,
      branchId: branchId.success ? branchId.data ?? null : null,
      videoKind: videoKind.success ? videoKind.data ?? null : null,
      topic,
    },
  });
});

/** Öğrenci: zayıf konu/kazanımlara göre video önerileri */
lessonVideos.get("/suggested", requireAuth, async (c) => {
  if (c.get("userRole") !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const profile = await studentProfileForUser(c.get("userId"));
  if (!profile) return c.json({ error: "student_profile_missing" }, 400);

  const gradeLevel = profile.gradeLevel;
  if (!gradeLevel) {
    return c.json({
      error: "grade_level_required",
      message: "Sınıf seviyeniz tanımlı değil.",
      videos: [],
      topics: [],
    });
  }

  const topics = parseWeakTopicTokens(c.req.query("topics"));
  const branchId = z.coerce.number().int().positive().optional().safeParse(c.req.query("branchId"));
  const videos = await suggestVideosForWeakTopics({
    gradeLevel,
    topics,
    branchId: branchId.success ? branchId.data : null,
    limit: 5,
  });

  return c.json({
    videos,
    topics,
    filters: {
      gradeLevel,
      branchId: branchId.success ? (branchId.data ?? null) : null,
    },
  });
});

/** Öğrenci: belirli öğretmenin sınıfa uygun videoları */
lessonVideos.get("/by-teacher/:teacherId", requireAuth, async (c) => {
  if (c.get("userRole") !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const teacherId = c.req.param("teacherId");
  if (!z.string().uuid().safeParse(teacherId).success) {
    return c.json({ error: "invalid_teacher_id" }, 400);
  }

  const profile = await studentProfileForUser(c.get("userId"));
  if (!profile) return c.json({ error: "student_profile_missing" }, 400);
  if (!profile.gradeLevel) {
    return c.json({ error: "grade_level_required", videos: [] });
  }

  const videos = await queryApprovedVideos({
    gradeLevel: profile.gradeLevel,
    teacherId,
    limit: 40,
  });
  return c.json({ videos, teacherId, gradeLevel: profile.gradeLevel });
});

lessonVideos.post("/", requireAuth, async (c) => {
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }
  const teacherId = await teacherIdForUser(c.get("userId"));
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);

  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const teaches = await teacherTeachesBranch(teacherId, parsed.data.branchId);
  if (!teaches) {
    return c.json({ error: "branch_not_on_teacher_profile", message: "Yalnızca profilinizdeki branşlar için video ekleyebilirsiniz." }, 400);
  }

  const branch = await pool.query(`select id from branches where id = $1 and is_active = true`, [
    parsed.data.branchId,
  ]);
  if (!branch.rowCount) return c.json({ error: "invalid_branch" }, 400);

  const countRes = await pool.query<{ n: string }>(
    `select count(*)::text as n from teacher_lesson_videos where teacher_id = $1 and status <> 'archived'`,
    [teacherId],
  );
  if (Number(countRes.rows[0]?.n ?? 0) >= 200) {
    return c.json({ error: "video_limit_reached", message: "En fazla 200 aktif video yayınlayabilirsiniz." }, 400);
  }

  const ins = await pool.query(
     `insert into teacher_lesson_videos (
       teacher_id, grade_level, branch_id, topic_title, outcome_code, outcome_title,
       title, description, video_url, video_kind, duration_minutes, status, moderation_status
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending_review')
     returning id`,
    [
      teacherId,
      parsed.data.gradeLevel,
      parsed.data.branchId,
      parsed.data.topicTitle.trim(),
      parsed.data.outcomeCode.trim(),
      parsed.data.outcomeTitle.trim(),
      parsed.data.title.trim(),
      parsed.data.description?.trim() ?? null,
      parsed.data.videoUrl.trim(),
      parsed.data.videoKind,
      parsed.data.durationMinutes ?? null,
      parsed.data.status,
    ],
  );

  const detail = await pool.query(`${videoSelectSql} where v.id = $1`, [ins.rows[0].id]);
  return c.json({ video: mapVideoRow(detail.rows[0]) }, 201);
});

/** Öğrenci: video izleme kaydı */
lessonVideos.post("/:videoId/view", requireAuth, async (c) => {
  if (c.get("userRole") !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }
  const profile = await studentProfileForUser(c.get("userId"));
  if (!profile?.gradeLevel) return c.json({ error: "grade_level_required" }, 400);

  const videoId = c.req.param("videoId");
  const visible = await pool.query(
    `select id from teacher_lesson_videos
     where id = $1 and grade_level = $2 and status = 'published' and moderation_status = 'approved'`,
    [videoId, profile.gradeLevel],
  );
  if (!visible.rowCount) return c.json({ error: "not_found" }, 404);

  try {
    await pool.query(
      `insert into lesson_video_views (video_id, student_id)
       values ($1, $2)
       on conflict (video_id, student_id) do update
         set watch_count = lesson_video_views.watch_count + 1,
             last_watched_at = now()`,
      [videoId, profile.studentId],
    );
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return c.json({ ok: true, tracked: false });
    throw e;
  }
  return c.json({ ok: true, tracked: true });
});

lessonVideos.patch("/:videoId", requireAuth, async (c) => {
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }
  const teacherId = await teacherIdForUser(c.get("userId"));
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);

  const videoId = c.req.param("videoId");
  const parsed = patchSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const own = await pool.query(
    `select id from teacher_lesson_videos where id = $1 and teacher_id = $2 and status <> 'archived'`,
    [videoId, teacherId],
  );
  if (!own.rowCount) return c.json({ error: "not_found" }, 404);

  const d = parsed.data;
  if (d.branchId) {
    const teaches = await teacherTeachesBranch(teacherId, d.branchId);
    if (!teaches) return c.json({ error: "branch_not_on_teacher_profile" }, 400);
    const branch = await pool.query(`select id from branches where id = $1 and is_active = true`, [d.branchId]);
    if (!branch.rowCount) return c.json({ error: "invalid_branch" }, 400);
  }

  const sets: string[] = ["updated_at = now()"];
  const args: unknown[] = [videoId];
  const add = (col: string, val: unknown) => {
    args.push(val);
    sets.push(`${col} = $${args.length}`);
  };

  if (d.gradeLevel != null) add("grade_level", d.gradeLevel);
  if (d.branchId != null) add("branch_id", d.branchId);
  if (d.topicTitle != null) add("topic_title", d.topicTitle.trim());
  if (d.outcomeCode != null) add("outcome_code", d.outcomeCode.trim());
  if (d.outcomeTitle != null) add("outcome_title", d.outcomeTitle.trim());
  if (d.title != null) add("title", d.title.trim());
  if (d.description !== undefined) add("description", d.description?.trim() ?? null);
  if (d.videoUrl != null) add("video_url", d.videoUrl.trim());
  if (d.videoKind != null) add("video_kind", d.videoKind);
  if (d.durationMinutes !== undefined) add("duration_minutes", d.durationMinutes);
  if (d.status != null) add("status", d.status);

  await pool.query(`update teacher_lesson_videos set ${sets.join(", ")} where id = $1`, args);

  const detail = await pool.query(`${videoSelectSql} where v.id = $1`, [videoId]);
  return c.json({ video: mapVideoRow(detail.rows[0]) });
});

lessonVideos.delete("/:videoId", requireAuth, async (c) => {
  if (c.get("userRole") !== "teacher") {
    return c.json({ error: "forbidden_teachers_only" }, 403);
  }
  const teacherId = await teacherIdForUser(c.get("userId"));
  if (!teacherId) return c.json({ error: "teacher_profile_missing" }, 400);

  const videoId = c.req.param("videoId");
  const r = await pool.query(
    `update teacher_lesson_videos set status = 'archived', updated_at = now()
     where id = $1 and teacher_id = $2 and status <> 'archived'
     returning id`,
    [videoId, teacherId],
  );
  if (!r.rowCount) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
