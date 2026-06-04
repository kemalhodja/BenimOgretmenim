export type LessonEvaluationAnswers = {
  masteryLikert: number;
  focusTopic: string;
  nextStepNote?: string;
};

type LessonProgressResult = {
  metrics: Record<string, unknown>;
  narrativeTr: string;
  model: string;
};

function likertToMasteryEstimate(likert: number): number {
  const map: Record<number, number> = {
    1: 0.25,
    2: 0.45,
    3: 0.65,
    4: 0.8,
    5: 0.95,
  };
  return map[likert] ?? 0.5;
}

/** Geçici: LLM yerine şablon + sayısal çıkarım. */
export function buildLessonProgressStub(input: LessonEvaluationAnswers): LessonProgressResult {
  const mastery = likertToMasteryEstimate(input.masteryLikert);
  const pct = Math.round(mastery * 100);
  const topic = input.focusTopic.trim();
  const note = (input.nextStepNote ?? "").trim();

  const narrativeTr = `Çocuğunuz bu derste “${topic}” konusunu öğretmen değerlendirmesine göre yaklaşık %${pct} düzeyinde kavradı.${
    note
      ? ` Haftaya ${note} üzerinden ilerlenebilir.`
      : " Bir sonraki derste bu temel üzerinden devam edilebilir."
  }`;

  const metrics = {
    topics: [
      {
        code: topic.toLowerCase().replace(/\s+/g, "_"),
        label: topic,
        mastery_estimate: mastery,
      },
    ],
    source: "stub_template_v1",
  };

  return {
    metrics,
    narrativeTr,
    model: "stub-template-v1",
  };
}

function getAiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.LESSON_AI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL ?? process.env.LESSON_AI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.LESSON_AI_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

function parseAiJson(content: string): { narrativeTr?: unknown; metrics?: unknown } | null {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") return parsed as { narrativeTr?: unknown; metrics?: unknown };
  } catch {
    return null;
  }
  return null;
}

async function buildLessonProgressWithProvider(input: LessonEvaluationAnswers): Promise<LessonProgressResult | null> {
  const config = getAiConfig();
  if (!config) return null;

  const fallback = buildLessonProgressStub(input);
  const prompt = [
    "Türkçe eğitim platformu için ders sonu öğrenme özeti üret.",
    "Yalnızca JSON döndür. Şema:",
    '{"narrativeTr":"veli/öğrenci için 2 cümlelik özet","metrics":{"topics":[{"code":"slug","label":"Konu","mastery_estimate":0.0}],"strengths":["..."],"risks":["..."],"next_actions":["..."],"guardian_note":"..."}}',
    `Öğretmen değerlendirmesi: ${input.masteryLikert}/5`,
    `Odak konu: ${input.focusTopic}`,
    `Sonraki adım notu: ${input.nextStepNote?.trim() || "Belirtilmedi"}`,
  ].join("\n");

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Sen pedagojik olarak temkinli, kısa ve veliye anlaşılır Türkçe ders özeti üreten bir eğitim asistanısın.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  const parsed = parseAiJson(content);
  if (!parsed || typeof parsed.narrativeTr !== "string") return null;

  return {
    narrativeTr: parsed.narrativeTr,
    metrics: {
      ...fallback.metrics,
      ...(parsed.metrics && typeof parsed.metrics === "object" ? parsed.metrics : {}),
      source: "llm_provider_v1",
    },
    model: config.model,
  };
}

export async function buildLessonProgress(input: LessonEvaluationAnswers): Promise<LessonProgressResult> {
  try {
    const aiResult = await buildLessonProgressWithProvider(input);
    if (aiResult) return aiResult;
  } catch {
    // AI sağlayıcısı geçici olarak yanıt vermezse ders tamamlama akışı bloklanmaz.
  }
  return buildLessonProgressStub(input);
}
