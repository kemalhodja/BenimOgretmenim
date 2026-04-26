import { Hono } from "hono";
import pg from "pg";
import { z } from "zod";
import { pool } from "../db.js";
import { buildLessonProgressStub } from "../lib/lessonAiStub.js";
import type { AppVariables } from "../types.js";
import { requireAuth } from "../middleware/requireAuth.js";

const answersSchema = z.object({
  masteryLikert: z.number().int().min(1).max(5),
  focusTopic: z.string().min(1).max(200),
  nextStepNote: z.string().max(2000).optional(),
});

const createEvaluationSchema = z.object({
  answers: answersSchema,
});

export const lessonEvaluations = new Hono<{ Variables: AppVariables }>();

const studentReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

/** Öğrenci: yorum yazılabilecek tamamlanmış ders oturumları (henüz yorum yok) */
lessonEvaluations.get("/reviewable", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const r = await pool.query(
    `select ls.id as lesson_session_id,
            ls.session_index,
            ls.scheduled_start,
            ls.actual_end,
            ls.status,
            lp.id as package_id,
            t.id as teacher_id,
            u.display_name as teacher_display_name
     from lesson_sessions ls
     join lesson_packages lp on lp.id = ls.package_id
     join students s on s.id = lp.student_id
     join teachers t on t.id = lp.teacher_id
     join users u on u.id = t.user_id
     where s.user_id = $1
       and ls.status = 'completed'
       and not exists (
         select 1 from reviews r
         where r.lesson_session_id = ls.id and r.reviewer_user_id = $1
       )
     order by coalesce(ls.actual_end, ls.scheduled_start, ls.created_at) desc
     limit 50`,
    [userId],
  );
  return c.json({ sessions: r.rows });
});

/** Öğrenci: gönderdiği yorumların geçmişi */
lessonEvaluations.get("/my-reviews", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }

  const r = await pool.query(
    `select r.id as review_id,
            r.rating,
            r.comment,
            r.created_at,
            ls.id as lesson_session_id,
            ls.session_index,
            t.id as teacher_id,
            u.display_name as teacher_display_name
     from reviews r
     join lesson_sessions ls on ls.id = r.lesson_session_id
     join lesson_packages lp on lp.id = ls.package_id
     join teachers t on t.id = lp.teacher_id
     join users u on u.id = t.user_id
     where r.reviewer_user_id = $1
     order by r.created_at desc
     limit 50`,
    [userId],
  );
  return c.json({ reviews: r.rows });
});

/** Öğrenci: bu oturum için kendi yorumunu getir (yoksa review: null) */
lessonEvaluations.get("/:lessonSessionId/review", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }
  const lessonSessionId = c.req.param("lessonSessionId");

  const row = await pool.query(
    `select r.id as review_id,
            r.rating,
            r.comment,
            r.created_at as review_created_at
     from lesson_sessions ls
     join lesson_packages lp on lp.id = ls.package_id
     join students s on s.id = lp.student_id
     left join reviews r
       on r.lesson_session_id = ls.id and r.reviewer_user_id = $2
     where ls.id = $1 and s.user_id = $2`,
    [lessonSessionId, userId],
  );
  if (!row.rowCount) {
    return c.json({ error: "lesson_session_not_found_or_forbidden" }, 404);
  }
  const rec = row.rows[0] as {
    review_id: string | null;
    rating: number | null;
    comment: string | null;
    review_created_at: Date | null;
  };
  if (!rec.review_id) {
    return c.json({ review: null });
  }
  return c.json({
    review: {
      id: rec.review_id,
      rating: rec.rating,
      comment: rec.comment,
      created_at: rec.review_created_at,
    },
  });
});

/** Öğrenci: tamamlanan derse yıldız + yorum (öğretmen ortalaması güncellenir) */
lessonEvaluations.post("/:lessonSessionId/review", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = c.get("userRole");
  if (role !== "student") {
    return c.json({ error: "forbidden_students_only" }, 403);
  }
  const lessonSessionId = c.req.param("lessonSessionId");
  const parsed = studentReviewBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const sessionRow = await client.query(
      `select ls.id,
              ls.session_index,
              lp.teacher_id,
              lp.student_id,
              ls.status,
              t.user_id as teacher_user_id
       from lesson_sessions ls
       join lesson_packages lp on lp.id = ls.package_id
       join students s on s.id = lp.student_id
       join teachers t on t.id = lp.teacher_id
       where ls.id = $1 and s.user_id = $2
       for update`,
      [lessonSessionId, userId],
    );
    if (!sessionRow.rowCount) {
      await client.query("rollback");
      return c.json({ error: "lesson_session_not_found_or_forbidden" }, 404);
    }
    const sr = sessionRow.rows[0] as {
      id: string;
      session_index: number;
      teacher_id: string;
      student_id: string;
      teacher_user_id: string;
      status: string;
    };
    if (sr.status !== "completed") {
      await client.query("rollback");
      return c.json({ error: "lesson_session_not_reviewable" }, 409);
    }

    const ins = await client.query(
      `insert into reviews (
         lesson_session_id, reviewer_user_id, rating, dimensions_jsonb, comment
       ) values ($1, $2, $3, '{}'::jsonb, $4)
       returning id, rating, comment, created_at`,
      [
        lessonSessionId,
        userId,
        parsed.data.rating,
        parsed.data.comment?.trim() || null,
      ],
    );

    await client.query(
      `with agg as (
         select round(avg(r.rating)::numeric, 2) as avg_r,
                count(*)::int as cnt
         from reviews r
         join lesson_sessions ls2 on ls2.id = r.lesson_session_id
         join lesson_packages lp2 on lp2.id = ls2.package_id
         where lp2.teacher_id = $1
       )
       update teachers t
       set rating_avg = agg.avg_r,
           rating_count = agg.cnt,
           updated_at = now()
       from agg
       where t.id = $1`,
      [sr.teacher_id],
    );

    const reviewId = ins.rows[0].id as string | number;
    const notifBody = `Ders #${sr.session_index} için öğrenci ${parsed.data.rating}/5 yıldız verdi.`;
    const notifPayload = JSON.stringify({
      type: "student_review",
      reviewId: String(reviewId),
      lessonSessionId,
      rating: parsed.data.rating,
    });
    await client.query(
      `insert into parent_notifications (
         recipient_user_id, student_id, snapshot_id, channel,
         title, body, payload_jsonb, delivery_status, sent_at
       ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
      [
        sr.teacher_user_id,
        sr.student_id,
        "Yeni ders yorumu",
        notifBody,
        notifPayload,
      ],
    );

    await client.query("commit");
    return c.json({ review: ins.rows[0] }, 201);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    if (e instanceof pg.DatabaseError && e.code === "23505") {
      return c.json({ error: "review_already_exists" }, 409);
    }
    const msg = e instanceof Error ? e.message : "transaction_failed";
    return c.json({ error: msg }, 500);
  } finally {
    client.release();
  }
});

/** Öğretmen ders sonu 3 soru + stub AI özet + veli bildirimi (JWT: öğretmen) */
lessonEvaluations.post(
  "/:lessonSessionId/evaluation",
  requireAuth,
  async (c) => {
    const lessonSessionId = c.req.param("lessonSessionId");
    const parsed = createEvaluationSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const filledByUserId = c.get("userId");
    const { answers } = parsed.data;

    const answersJson = {
      q1_mastery_likert: answers.masteryLikert,
      q2_focus_topic: answers.focusTopic,
      q3_next_step_note: answers.nextStepNote ?? "",
    };

    const client = await pool.connect();
    try {
      await client.query("begin");

      const sessionRow = await client.query(
        `select ls.id,
                lp.id as package_id,
                lp.student_id,
                lp.teacher_id,
                t.user_id as teacher_user_id
         from lesson_sessions ls
         join lesson_packages lp on lp.id = ls.package_id
         join teachers t on t.id = lp.teacher_id
         where ls.id = $1
         for update`,
        [lessonSessionId],
      );

      if (!sessionRow.rowCount) {
        await client.query("rollback");
        return c.json({ error: "lesson_session_not_found" }, 404);
      }

      const row = sessionRow.rows[0] as {
        id: string;
        package_id: string;
        student_id: string;
        teacher_id: string;
        teacher_user_id: string;
      };

      if (row.teacher_user_id !== filledByUserId) {
        await client.query("rollback");
        return c.json({ error: "forbidden_not_class_teacher" }, 403);
      }

      const evalInsert = await client.query(
        `insert into lesson_session_evaluations (
           lesson_session_id, filled_by_user_id, answers_jsonb, ai_status, updated_at
         ) values ($1, $2, $3::jsonb, 'completed', now())
         returning id, created_at`,
        [lessonSessionId, filledByUserId, JSON.stringify(answersJson)],
      );

      const evaluationId = evalInsert.rows[0].id as string;

      const stub = buildLessonProgressStub({
        masteryLikert: answers.masteryLikert,
        focusTopic: answers.focusTopic,
        nextStepNote: answers.nextStepNote,
      });

      const snap = await client.query(
        `insert into ai_progress_snapshots (
           evaluation_id, student_id, teacher_id, package_id,
           metrics_jsonb, narrative_tr, ai_model
         ) values ($1, $2, $3, $4, $5::jsonb, $6, $7)
         returning id`,
        [
          evaluationId,
          row.student_id,
          row.teacher_id,
          row.package_id,
          JSON.stringify(stub.metrics),
          stub.narrativeTr,
          stub.model,
        ],
      );

      const snapshotId = snap.rows[0].id as string;

      const guardians = await client.query(
        `select guardian_user_id from student_guardians where student_id = $1`,
        [row.student_id],
      );

      const notifications: { id: string; recipient_user_id: string }[] = [];
      for (const g of guardians.rows) {
        const uid = g.guardian_user_id as string;
        const n = await client.query(
          `insert into parent_notifications (
             recipient_user_id, student_id, snapshot_id, channel,
             title, body, payload_jsonb, delivery_status, sent_at
           ) values ($1, $2, $3, 'in_app', $4, $5, $6::jsonb, 'sent', now())
           returning id, recipient_user_id`,
          [
            uid,
            row.student_id,
            snapshotId,
            "Ders sonu gelişim özeti",
            stub.narrativeTr,
            JSON.stringify({ evaluationId, lessonSessionId }),
          ],
        );
        notifications.push(n.rows[0] as { id: string; recipient_user_id: string });
      }

      await client.query("commit");

      return c.json(
        {
          evaluationId,
          snapshotId,
          narrativeTr: stub.narrativeTr,
          metrics: stub.metrics,
          notificationsCreated: notifications.length,
          notifications,
        },
        201,
      );
    } catch (e) {
      await client.query("rollback").catch(() => {});
      if (e instanceof pg.DatabaseError && e.code === "23505") {
        return c.json({ error: "evaluation_already_exists" }, 409);
      }
      const msg = e instanceof Error ? e.message : "transaction_failed";
      return c.json({ error: msg }, 500);
    } finally {
      client.release();
    }
  },
);

lessonEvaluations.get(
  "/:lessonSessionId/evaluation",
  requireAuth,
  async (c) => {
    const lessonSessionId = c.req.param("lessonSessionId");
    const userId = c.get("userId");

    const access = await pool.query(
      `select e.id,
              lp.student_id,
              st.user_id as student_user_id,
              t.user_id as teacher_user_id
       from lesson_session_evaluations e
       join lesson_sessions ls on ls.id = e.lesson_session_id
       join lesson_packages lp on lp.id = ls.package_id
       join students st on st.id = lp.student_id
       join teachers t on t.id = lp.teacher_id
       where e.lesson_session_id = $1`,
      [lessonSessionId],
    );
    if (!access.rowCount) {
      return c.json({ error: "not_found" }, 404);
    }

    const a = access.rows[0] as {
      student_user_id: string;
      teacher_user_id: string;
      student_id: string;
    };

    const g = await pool.query(
      `select 1 from student_guardians where student_id = $1 and guardian_user_id = $2`,
      [a.student_id, userId],
    );

    const allowed =
      userId === a.teacher_user_id ||
      userId === a.student_user_id ||
      (g.rowCount ?? 0) > 0;

    if (!allowed) {
      return c.json({ error: "forbidden" }, 403);
    }

    const r = await pool.query(
      `select e.id, e.answers_jsonb, e.ai_status, e.created_at,
              s.id as snapshot_id, s.narrative_tr, s.metrics_jsonb, s.ai_model
       from lesson_session_evaluations e
       left join ai_progress_snapshots s on s.evaluation_id = e.id
       where e.lesson_session_id = $1`,
      [lessonSessionId],
    );
    return c.json({ evaluation: r.rows[0] });
  },
);
