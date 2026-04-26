export type LessonEvaluationAnswers = {
  masteryLikert: number;
  focusTopic: string;
  nextStepNote?: string;
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
export function buildLessonProgressStub(input: LessonEvaluationAnswers): {
  metrics: Record<string, unknown>;
  narrativeTr: string;
  model: string;
} {
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
