import type { Pool, PoolClient } from "pg";

export function homeworkResolveMinutes(): number {
  const n = Number(process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES ?? "20");
  if (!Number.isFinite(n) || n < 1 || n > 24 * 60) return 20;
  return Math.floor(n);
}

export function homeworkSatisfactionRewardMinor(): number {
  // Varsayılan: 10,00 TL
  const n = Number(process.env.HOMEWORK_SATISFACTION_REWARD_MINOR ?? "1000");
  if (!Number.isFinite(n) || n < 1 || n > 1_000_000) return 1000;
  return Math.floor(n);
}

export type HomeworkUrgencyLevel = "normal" | "priority" | "urgent";

export function homeworkTargetMinutesForUrgency(urgency: HomeworkUrgencyLevel): number {
  if (urgency === "urgent") return 10;
  if (urgency === "priority") return 15;
  return homeworkResolveMinutes();
}

type HomeworkAiJson = Record<string, unknown>;

function homeworkAiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.HOMEWORK_AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.HOMEWORK_AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.HOMEWORK_AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

async function callHomeworkAiJson(prompt: string): Promise<HomeworkAiJson | null> {
  const config = homeworkAiConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sen Türkçe eğitim platformunda OCR/konu sınıflandırma ve çözüm kalite değerlendirmesi yapan kısa JSON üreten asistansın.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as HomeworkAiJson) : null;
  } catch {
    return null;
  }
}

export function homeworkRoutingPriorityFromMetadata(meta: unknown): number {
  if (!meta || typeof meta !== "object") return 50;
  const n = Number((meta as HomeworkAiJson).routing_priority);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildHomeworkHeuristicMetadata(input: {
  branchId: number;
  topic: string;
  helpText: string;
  gradeLevelText?: string | null;
  targetExam?: string | null;
  learningObjective?: string | null;
  urgencyLevel: HomeworkUrgencyLevel;
  imageUrls: string[];
}): HomeworkAiJson {
  const topic = input.topic.trim();
  const helpText = input.helpText.trim();
  const helpLen = helpText.length;
  const imageCount = input.imageUrls.length;
  const combined = `${topic} ${helpText} ${input.learningObjective ?? ""} ${input.targetExam ?? ""}`;

  const needsClarification = helpLen < 20 && imageCount === 0;
  const contentQuality: "low" | "medium" | "high" =
    needsClarification ? "low" : helpLen >= 80 || imageCount >= 2 ? "high" : "medium";

  let routingPriority = 50;
  if (input.urgencyLevel === "urgent") routingPriority += 25;
  else if (input.urgencyLevel === "priority") routingPriority += 15;
  if (contentQuality === "high") routingPriority += 10;
  if (contentQuality === "low") routingPriority -= 15;
  if (needsClarification) routingPriority -= 10;
  if (imageCount >= 1) routingPriority += 5;
  if (input.targetExam?.trim()) routingPriority += 5;
  if (input.learningObjective?.trim()) routingPriority += 5;
  routingPriority = Math.max(0, Math.min(100, routingPriority));

  const recommendedTeacherTags: string[] = [];
  if (input.targetExam?.trim()) recommendedTeacherTags.push(`${input.targetExam.trim()} deneyimi`);
  if (input.gradeLevelText?.trim()) recommendedTeacherTags.push(`${input.gradeLevelText.trim()} seviyesi`);
  if (imageCount > 0) recommendedTeacherTags.push("görsel çözüm");
  if (/sınav|net|puan|çıkmış|deneme/i.test(combined)) recommendedTeacherTags.push("sınav odaklı");
  if (/problem|uygulama|grafik|geometri/i.test(combined)) recommendedTeacherTags.push("adım adım çözüm");

  const routingNote = needsClarification
    ? "Öğrenci açıklaması kısa; üstlenmeden önce netleştirme gerekebilir."
    : input.urgencyLevel === "urgent"
      ? "Acil SLA — hızlı yanıt bekleniyor."
      : contentQuality === "high"
        ? "Detaylı gönderi; havuzda öncelikli yönlendirme."
        : null;

  return {
    source: "heuristic_v2",
    ocr_status: imageCount ? "image_attached_ocr_pending" : "no_image",
    branch_id: input.branchId,
    topic_hint: input.learningObjective?.trim() || topic,
    difficulty: input.urgencyLevel === "urgent" ? "time_sensitive" : contentQuality === "high" ? "advanced" : "standard",
    estimated_solution_minutes: homeworkTargetMinutesForUrgency(input.urgencyLevel),
    similar_practice: [
      `${topic} için 1 temel tekrar sorusu`,
      `${topic} için 1 benzer uygulama`,
      `${topic} için 1 sınav tarzı soru`,
    ],
    routing_priority: routingPriority,
    needs_clarification: needsClarification,
    content_quality: contentQuality,
    recommended_teacher_tags: recommendedTeacherTags,
    routing_note: routingNote,
  };
}

export async function classifyHomeworkPost(input: {
  branchId: number;
  topic: string;
  helpText: string;
  gradeLevelText?: string | null;
  targetExam?: string | null;
  learningObjective?: string | null;
  urgencyLevel: HomeworkUrgencyLevel;
  imageUrls: string[];
}): Promise<{ aiMetadata: HomeworkAiJson; storageBackend: string }> {
  const hasInlineImages = input.imageUrls.some((url) => /^data:image\//i.test(url));
  const storageBackend =
    process.env.HOMEWORK_STORAGE_PROVIDER ??
    (hasInlineImages ? "inline_data_url_pending_object_storage" : input.imageUrls.length ? "external_https_url" : "text_only");
  const fallback = buildHomeworkHeuristicMetadata(input);

  const ai = await callHomeworkAiJson(
    [
      "Soru gönderisini sınıflandır. Yalnızca JSON dön.",
      "Alanlar: ocr_text, subject, topic_hint, difficulty, estimated_solution_minutes, similar_practice, routing_note, routing_priority (0-100), needs_clarification (boolean), content_quality (low|medium|high), recommended_teacher_tags (string[]).",
      `Branş id: ${input.branchId}`,
      `Konu: ${input.topic}`,
      `Açıklama: ${input.helpText}`,
      `Sınıf: ${input.gradeLevelText ?? ""}`,
      `Sınav: ${input.targetExam ?? ""}`,
      `Kazanım: ${input.learningObjective ?? ""}`,
      `Aciliyet: ${input.urgencyLevel}`,
      `Görsel sayısı: ${input.imageUrls.length}`,
    ].join("\n"),
  );

  const merged: HomeworkAiJson = {
    ...fallback,
    ...(ai ?? {}),
    storage_backend: storageBackend,
    provider: ai ? "llm_provider_v1" : "heuristic_v2",
  };
  merged.routing_priority = homeworkRoutingPriorityFromMetadata(merged);

  return {
    aiMetadata: merged,
    storageBackend,
  };
}

export async function scoreHomeworkAnswer(input: {
  answerText: string;
  answerImageUrls: string[];
  answerVideoUrl?: string | null;
  targetAnswerMinutes?: number | null;
}): Promise<{ qualityScore: number; quality: HomeworkAiJson }> {
  const hasVisual = input.answerImageUrls.length > 0 || Boolean(input.answerVideoUrl);
  const lengthScore = Math.min(35, Math.floor(input.answerText.trim().length / 18));
  const visualScore = hasVisual ? 15 : 0;
  const structureScore = /adım|çünkü|sonuç|kontrol|benzer/i.test(input.answerText) ? 20 : 10;
  const baseScore = Math.max(35, Math.min(100, 30 + lengthScore + visualScore + structureScore));
  const ai = await callHomeworkAiJson(
    [
      "Öğretmen çözümünü kalite açısından değerlendir. Yalnızca JSON dön.",
      "Alanlar: quality_score (0-100), strengths, missing_parts, practice_suggestions.",
      `Cevap: ${input.answerText}`,
      `Görsel sayısı: ${input.answerImageUrls.length}`,
      `Video var mı: ${Boolean(input.answerVideoUrl)}`,
      `Hedef dakika: ${input.targetAnswerMinutes ?? ""}`,
    ].join("\n"),
  );
  const aiScore = typeof ai?.quality_score === "number" ? ai.quality_score : null;
  const qualityScore = Math.max(0, Math.min(100, Math.round(aiScore ?? baseScore)));
  return {
    qualityScore,
    quality: {
      source: ai ? "llm_provider_v1" : "heuristic_v1",
      quality_score: qualityScore,
      rubric: {
        explanation_length: lengthScore,
        visual_support: visualScore,
        step_by_step_signal: structureScore,
      },
      ...(ai ?? {}),
    },
  };
}

/** Süresi dolmuş üstlenmeleri havuza iade eder (answered değilse). */
export async function releaseExpiredHomeworkClaims(db: Pool | PoolClient): Promise<number> {
  const r = await db.query(
    `update student_homework_posts
     set status = 'open',
         claimed_by_teacher_id = null,
         claimed_at = null,
         resolve_deadline_at = null,
         updated_at = now()
     where status = 'claimed'
       and resolve_deadline_at is not null
       and resolve_deadline_at < now()
       and answered_at is null
     returning id`,
  );
  return r.rowCount ?? 0;
}
