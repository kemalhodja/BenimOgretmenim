import { describe, expect, it } from "vitest";
import { buildLessonProgressStub } from "./lessonAiStub.js";

describe("buildLessonProgressStub", () => {
  it("embeds focus topic and mastery percent in narrative", () => {
    const r = buildLessonProgressStub({
      masteryLikert: 4,
      focusTopic: "Türev",
      nextStepNote: "integral alıştırması",
    });
    expect(r.narrativeTr).toContain("Türev");
    expect(r.narrativeTr).toMatch(/%\d+/);
    expect(r.narrativeTr).toContain("integral");
    expect(r.model).toBe("stub-template-v1");
    expect(r.metrics).toHaveProperty("topics");
    expect((r.metrics as { source?: string }).source).toBe("stub_template_v1");
  });

  it("uses default continuation when nextStepNote empty", () => {
    const r = buildLessonProgressStub({
      masteryLikert: 2,
      focusTopic: "Kesirler",
    });
    expect(r.narrativeTr).toContain("Kesirler");
    expect(r.narrativeTr).toContain("Bir sonraki derste");
  });
});
