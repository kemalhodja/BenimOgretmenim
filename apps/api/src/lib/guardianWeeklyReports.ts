import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";
import { queueGuardianEmail } from "./emailDelivery.js";
import { queueUserSms } from "./smsDelivery.js";

type Db = Pool | PoolClient;

function reportAiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.REPORT_AI_API_KEY ?? process.env.HOMEWORK_AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.REPORT_AI_BASE_URL ?? process.env.HOMEWORK_AI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.REPORT_AI_MODEL ?? process.env.HOMEWORK_AI_MODEL ?? "gpt-4o-mini",
  };
}

async function generateReportText(prompt: string): Promise<string | null> {
  const config = reportAiConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "Sen Türkçe yazan profesyonel bir eğitim koçusun. Veliye haftalık öğrenci gelişim özeti yaz. Net, güven verici, 3-5 kısa paragraf. Abartma; veriye sadık kal.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

function weekStartMonday(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function fallbackReport(studentName: string, signals: Record<string, unknown>): string {
  const tests = Number(signals.testCount ?? 0);
  const avg = signals.avgScore != null ? `%${Math.round(Number(signals.avgScore))}` : "—";
  const weak = Array.isArray(signals.weakTopics) ? (signals.weakTopics as string[]).slice(0, 3).join(", ") : "—";
  return [
    `Sayın veli, ${studentName} için haftalık özet:`,
    tests > 0
      ? `Bu hafta ${tests} deneme/test kaydı işlendi; ortalama başarı ${avg}.`
      : "Bu hafta yeni deneme kaydı sınırlı; çalışma planı ritmini korumak önemli.",
    weak !== "—" ? `Odak tekrar konuları: ${weak}.` : "",
    "Canlı ders notları ve öğretmen geri bildirimleri panelde görüntülenebilir.",
    "Sorularınız için destek hattı veya öğretmen mesajları üzerinden iletişim kurabilirsiniz.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type WeeklyReportRunResult = { created: number; skipped: number; failed: number };

export async function runGuardianWeeklyReports(client: Db = pool): Promise<WeeklyReportRunResult> {
  const result: WeeklyReportRunResult = { created: 0, skipped: 0, failed: 0 };
  const weekStart = weekStartMonday();

  let pairs;
  try {
    pairs = await client.query<{
      guardian_user_id: string;
      student_id: string;
      student_display_name: string;
    }>(
      `select sg.guardian_user_id, sg.student_id, su.display_name as student_display_name
       from student_guardians sg
       join students s on s.id = sg.student_id
       join users su on su.id = s.user_id`,
    );
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01") return result;
    throw e;
  }

  for (const pair of pairs.rows) {
    const dedupeKey = `weekly:${pair.guardian_user_id}:${pair.student_id}:${weekStart}`;
    const exists = await client.query(`select 1 from guardian_weekly_reports where dedupe_key = $1`, [dedupeKey]);
    if (exists.rowCount) {
      result.skipped++;
      continue;
    }

    const [attempts, curriculum, notes, reviews] = await Promise.all([
      client.query(
        `select title, score_percent, weak_topics_jsonb, created_at
         from student_assessment_attempts
         where student_id = $1 and created_at >= now() - interval '7 days'
         order by created_at desc limit 10`,
        [pair.student_id],
      ),
      client.query(
        `select branch_name, unit_title, correct_count, question_count, weak_outcomes_jsonb, mastery_level
         from student_curriculum_test_attempts
         where student_id = $1 and created_at >= now() - interval '7 days'
         order by created_at desc limit 5`,
        [pair.student_id],
      ),
      client.query(
        `select left(coalesce(csn.body, ''), 200) as snippet, csn.created_at
         from classroom_session_notes csn
         join lesson_sessions ls on ls.id = csn.subject_id and csn.subject_type = 'lesson_session'
         join lesson_packages lp on lp.id = ls.package_id
         where lp.student_id = $1 and csn.created_at >= now() - interval '7 days'
         order by csn.created_at desc limit 8`,
        [pair.student_id],
      ).catch(() => ({ rows: [] as Array<{ snippet: string; created_at: string }> })),
      client.query(
        `select r.rating, left(coalesce(r.comment, ''), 120) as comment_preview, r.created_at
         from reviews r
         join lesson_sessions ls on ls.id = r.lesson_session_id
         join lesson_packages lp on lp.id = ls.package_id
         where lp.student_id = $1 and r.created_at >= now() - interval '7 days'
         order by r.created_at desc limit 5`,
        [pair.student_id],
      ).catch(() => ({ rows: [] as Array<{ rating: number; comment_preview: string }> })),
    ]);

    const scores = attempts.rows
      .map((r) => Number(r.score_percent))
      .filter((n) => Number.isFinite(n));
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const weakTopics = attempts.rows.flatMap((r) =>
      Array.isArray(r.weak_topics_jsonb) ? r.weak_topics_jsonb.map(String) : [],
    );

    const signals = {
      testCount: attempts.rowCount,
      avgScore,
      weakTopics: [...new Set(weakTopics)].slice(0, 6),
      curriculumHighlights: curriculum.rows.slice(0, 3),
      whiteboardSnippets: notes.rows.map((r) => r.snippet),
      reviewAvg:
        reviews.rows.length > 0
          ? reviews.rows.reduce((s, r) => s + Number(r.rating), 0) / reviews.rows.length
          : null,
    };

    const aiPrompt = [
      `Öğrenci: ${pair.student_display_name}`,
      `Hafta başlangıcı: ${weekStart}`,
      `Test/deneme: ${JSON.stringify(attempts.rows)}`,
      `Kazanım testleri: ${JSON.stringify(curriculum.rows)}`,
      `Tahta not özetleri: ${JSON.stringify(notes.rows)}`,
      `Ders değerlendirmeleri: ${JSON.stringify(reviews.rows)}`,
    ].join("\n");

    const body =
      (await generateReportText(aiPrompt)) ??
      fallbackReport(pair.student_display_name, signals);

    try {
      const ins = await client.query<{ id: string }>(
        `insert into guardian_weekly_reports (
           guardian_user_id, student_id, week_start, report_title, report_body,
           report_jsonb, delivery_status, dedupe_key, sent_at
         ) values ($1, $2, $3::date, $4, $5, $6::jsonb, 'sent', $7, now())
         returning id`,
        [
          pair.guardian_user_id,
          pair.student_id,
          weekStart,
          `${pair.student_display_name} — haftalık gelişim özeti`,
          body,
          JSON.stringify(signals),
          dedupeKey,
        ],
      );

      await client.query(
        `insert into parent_notifications (
           recipient_user_id, student_id, snapshot_id, channel,
           title, body, payload_jsonb, delivery_status, sent_at
         ) values ($1, $2, null, 'in_app', $3, $4, $5::jsonb, 'sent', now())`,
        [
          pair.guardian_user_id,
          pair.student_id,
          "Haftalık gelişim raporu",
          body.slice(0, 500),
          JSON.stringify({ kind: "guardian_weekly_report", reportId: ins.rows[0]?.id, weekStart }),
        ],
      );

      await queueGuardianEmail({
        guardianUserId: pair.guardian_user_id,
        templateKey: "guardian_weekly_report",
        subject: `${pair.student_display_name} — haftalık gelişim raporu`,
        bodyText: body,
        payload: { studentId: pair.student_id, weekStart },
      }, client);

      await queueUserSms({
        userId: pair.guardian_user_id,
        templateKey: "guardian_weekly_report",
        bodyText: `${pair.student_display_name} haftalık gelişim özeti panelinizde. ${body.slice(0, 120)}…`,
      }, client);

      result.created++;
    } catch {
      result.failed++;
    }
  }

  return result;
}
