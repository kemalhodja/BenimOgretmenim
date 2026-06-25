import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { signAccessToken } from "./auth/jwt.js";
import { pool } from "./db.js";

async function lessonVideoTablesAvailable(): Promise<boolean> {
  const health = await app.request("http://localhost/health");
  if (health.status !== 200) return false;
  const r = await pool.query<{ exists: boolean }>(
    `select to_regclass('public.teacher_lesson_videos') is not null
        and to_regclass('public.lesson_video_views') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'teacher_lesson_videos'
            and column_name = 'moderation_status'
        ) as exists`,
  );
  return r.rows[0]?.exists === true;
}

async function ensureBranch(suffix: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `insert into branches (name, slug)
     values ($1, $2)
     on conflict (slug) do update set name = excluded.name
     returning id`,
    [`Video Test ${suffix}`, `video-test-${suffix}`],
  );
  return r.rows[0].id;
}

async function createStudent(suffix: string, gradeLevel: number | null) {
  const email = `video-student-${suffix}@example.test`;
  const ur = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, 'student')
     returning id`,
    [email, `Video Student ${suffix}`],
  );
  const userId = ur.rows[0].id;
  const sr = await pool.query<{ id: string }>(
    `insert into students (user_id, grade_level) values ($1, $2) returning id`,
    [userId, gradeLevel],
  );
  const token = await signAccessToken({ userId, role: "student" });
  return { userId, studentId: sr.rows[0].id, token };
}

async function createTeacher(suffix: string, branchId: number, withBranch = true) {
  const email = `video-teacher-${suffix}@example.test`;
  const ur = await pool.query<{ id: string }>(
    `insert into users (email, display_name, role)
     values ($1, $2, 'teacher')
     returning id`,
    [email, `Video Teacher ${suffix}`],
  );
  const userId = ur.rows[0].id;
  const tr = await pool.query<{ id: string }>(
    `insert into teachers (user_id, verification_status) values ($1, 'verified') returning id`,
    [userId],
  );
  const teacherId = tr.rows[0].id;
  if (withBranch) {
    await pool.query(`insert into teacher_branches (teacher_id, branch_id) values ($1, $2)`, [
      teacherId,
      branchId,
    ]);
  }
  const token = await signAccessToken({ userId, role: "teacher" });
  return { userId, teacherId, token };
}

describe("lesson videos", () => {
  it("filters student videos by grade level", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);
    const student8 = await createStudent(`${suffix}-8`, 8);
    const student10 = await createStudent(`${suffix}-10`, 10);

    const createRes = await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 8,
        branchId,
        topicTitle: "Üslü sayılar",
        outcomeCode: "M.8.1.1",
        outcomeTitle: "Üslü ifadeleri yorumlar",
        title: "8. sınıf üslü sayılar",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "lesson",
      }),
    });
    expect(createRes.status).toBe(201);

    await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 10,
        branchId,
        topicTitle: "Fonksiyonlar",
        outcomeCode: "M.10.2.1",
        outcomeTitle: "Fonksiyon kavramı",
        title: "10. sınıf fonksiyonlar",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "exam_prep",
      }),
    });

    await pool.query(
      `update teacher_lesson_videos set moderation_status = 'approved' where teacher_id = $1`,
      [teacher.teacherId],
    );

    const list8 = await app.request("http://localhost/v1/lesson-videos", {
      headers: { Authorization: `Bearer ${student8.token}` },
    });
    expect(list8.status).toBe(200);
    const body8 = (await list8.json()) as {
      videos: Array<{ title: string; gradeLevel: number }>;
      facets: { total: number; lesson: number; examPrep: number };
    };
    expect(body8.videos.every((v) => v.gradeLevel === 8)).toBe(true);
    expect(body8.videos.some((v) => v.title.includes("8. sınıf"))).toBe(true);
    expect(body8.videos.some((v) => v.title.includes("10. sınıf"))).toBe(false);
    expect(body8.facets.total).toBeGreaterThanOrEqual(1);

    const list10 = await app.request("http://localhost/v1/lesson-videos", {
      headers: { Authorization: `Bearer ${student10.token}` },
    });
    const body10 = (await list10.json()) as { videos: Array<{ gradeLevel: number }> };
    expect(body10.videos.every((v) => v.gradeLevel === 10)).toBe(true);
  });

  it("ignores client gradeLevel override query", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-override`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);
    const student8 = await createStudent(`${suffix}-8`, 8);

    await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 10,
        branchId,
        topicTitle: "Gizli 10",
        outcomeCode: "M.10.1.1",
        outcomeTitle: "Gizli",
        title: "10. sınıf gizli video",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "lesson",
      }),
    });

    const list = await app.request("http://localhost/v1/lesson-videos?gradeLevel=10", {
      headers: { Authorization: `Bearer ${student8.token}` },
    });
    const body = (await list.json()) as { videos: Array<{ gradeLevel: number; title: string }> };
    expect(body.videos.every((v) => v.gradeLevel === 8)).toBe(true);
    expect(body.videos.some((v) => v.title.includes("gizli"))).toBe(false);
  });

  it("tracks student views", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-view`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);
    const student = await createStudent(`${suffix}`, 8);

    const createRes = await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 8,
        branchId,
        topicTitle: "İzlenme testi",
        outcomeCode: "M.8.9.9",
        outcomeTitle: "İzlenme",
        title: "İzlenme videosu",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "lesson",
      }),
    });
    const created = (await createRes.json()) as { video: { id: string } };

    await pool.query(
      `update teacher_lesson_videos set moderation_status = 'approved' where id = $1`,
      [created.video.id],
    );

    const view1 = await app.request(`http://localhost/v1/lesson-videos/${created.video.id}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${student.token}` },
    });
    expect(view1.status).toBe(200);

    const view2 = await app.request(`http://localhost/v1/lesson-videos/${created.video.id}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${student.token}` },
    });
    expect(view2.status).toBe(200);

    const mine = await app.request("http://localhost/v1/lesson-videos/mine", {
      headers: { Authorization: `Bearer ${teacher.token}` },
    });
    const mineBody = (await mine.json()) as {
      videos: Array<{ id: string; viewCount: number; uniqueViewerCount: number }>;
    };
    const row = mineBody.videos.find((v) => v.id === created.video.id);
    expect(row?.viewCount).toBe(2);
    expect(row?.uniqueViewerCount).toBe(1);
  });

  it("rejects video for branch not on teacher profile", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-branch`;
    const branchA = await ensureBranch(`${suffix}-a`);
    const branchB = await ensureBranch(`${suffix}-b`);
    const teacher = await createTeacher(suffix, branchA, true);

    const res = await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 8,
        branchId: branchB,
        topicTitle: "Yanlış branş",
        outcomeCode: "M.8.1.1",
        outcomeTitle: "Test",
        title: "Yanlış branş videosu",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "lesson",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects disallowed video hosts", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-host`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);

    const res = await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 8,
        branchId,
        topicTitle: "Kötü host",
        outcomeCode: "M.8.1.1",
        outcomeTitle: "Test",
        title: "Kötü host",
        videoUrl: "https://evil.example.com/video",
        videoKind: "lesson",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("hides pending videos from students until approved", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-mod`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);
    const student = await createStudent(`${suffix}`, 8);

    const createRes = await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 8,
        branchId,
        topicTitle: "Moderasyon",
        outcomeCode: "M.8.2.2",
        outcomeTitle: "Test",
        title: "Bekleyen video",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "lesson",
      }),
    });
    const created = (await createRes.json()) as { video: { id: string; moderationStatus?: string } };
    expect(createRes.status).toBe(201);
    expect(created.video.moderationStatus).toBe("pending_review");

    const pendingList = await app.request("http://localhost/v1/lesson-videos", {
      headers: { Authorization: `Bearer ${student.token}` },
    });
    const pendingBody = (await pendingList.json()) as { videos: Array<{ title: string }> };
    expect(pendingBody.videos.some((v) => v.title.includes("Bekleyen"))).toBe(false);

    await pool.query(
      `update teacher_lesson_videos set moderation_status = 'approved' where id = $1`,
      [created.video.id],
    );

    const approvedList = await app.request("http://localhost/v1/lesson-videos", {
      headers: { Authorization: `Bearer ${student.token}` },
    });
    const approvedBody = (await approvedList.json()) as { videos: Array<{ title: string }> };
    expect(approvedBody.videos.some((v) => v.title.includes("Bekleyen"))).toBe(true);
  });

  it("requires grade level on student registration", async () => {
    const res = await app.request("http://localhost/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `no-grade-${Date.now()}@example.test`,
        password: "password123",
        displayName: "No Grade",
        role: "student",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns curriculum outcomes for teacher", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-curr`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);

    const res = await app.request(
      `http://localhost/v1/lesson-videos/curriculum-outcomes?gradeLevel=8&branchSlug=matematik`,
      { headers: { Authorization: `Bearer ${teacher.token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { outcomes: Array<{ outcomeCode: string }> };
    expect(body.outcomes.length).toBeGreaterThan(0);
  });

  it("guardian sees linked student videos only", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-gua`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);
    const student = await createStudent(`${suffix}`, 8);

    const gEmail = `guardian-${suffix}@example.test`;
    const gUser = await pool.query<{ id: string }>(
      `insert into users (email, display_name, role) values ($1, 'G', 'guardian') returning id`,
      [gEmail],
    );
    const guardianUserId = gUser.rows[0].id;
    await pool.query(
      `insert into student_guardians (student_id, guardian_user_id, relationship, is_primary)
       values ($1, $2, 'veli', true)`,
      [student.studentId, guardianUserId],
    );
    const guardianToken = await signAccessToken({ userId: guardianUserId, role: "guardian" });

    await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 8,
        branchId,
        topicTitle: "Veli test",
        outcomeCode: "M.8.3.3",
        outcomeTitle: "Veli kazanım",
        title: "Veli görünür video",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "lesson",
      }),
    });
    await pool.query(`update teacher_lesson_videos set moderation_status = 'approved' where teacher_id = $1`, [
      teacher.teacherId,
    ]);

    const ok = await app.request(
      `http://localhost/v1/lesson-videos/for-guardian?studentId=${student.studentId}`,
      { headers: { Authorization: `Bearer ${guardianToken}` } },
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { videos: Array<{ title: string }> };
    expect(body.videos.some((v) => v.title.includes("Veli"))).toBe(true);

    const otherStudent = await createStudent(`${suffix}-other`, 8);
    const denied = await app.request(
      `http://localhost/v1/lesson-videos/for-guardian?studentId=${otherStudent.studentId}`,
      { headers: { Authorization: `Bearer ${guardianToken}` } },
    );
    expect(denied.status).toBe(403);
  });

  it("suggests videos for weak topics", async () => {
    if (!(await lessonVideoTablesAvailable())) return;

    const suffix = `${Date.now()}-sug`;
    const branchId = await ensureBranch(suffix);
    const teacher = await createTeacher(suffix, branchId);
    const student = await createStudent(`${suffix}`, 8);

    await app.request("http://localhost/v1/lesson-videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacher.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gradeLevel: 8,
        branchId,
        topicTitle: "Üslü sayılar",
        outcomeCode: "M.8.1.1",
        outcomeTitle: "Üslü ifadeler",
        title: "Öneri test üslü video",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoKind: "lesson",
      }),
    });
    await pool.query(`update teacher_lesson_videos set moderation_status = 'approved' where teacher_id = $1`, [
      teacher.teacherId,
    ]);

    const res = await app.request(
      "http://localhost/v1/lesson-videos/suggested?topics=üslü,sayılar",
      { headers: { Authorization: `Bearer ${student.token}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { videos: Array<{ title: string; matchScore: number }> };
    expect(body.videos.some((v) => v.title.includes("üslü"))).toBe(true);
    expect(body.videos[0]?.matchScore).toBeGreaterThan(0);
  });
});
