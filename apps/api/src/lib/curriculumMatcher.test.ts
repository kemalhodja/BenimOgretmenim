import { describe, expect, it, vi } from "vitest";
import { matchCurriculumOutcomes } from "./curriculumMatcher.js";

function mockPool(rows: Array<Record<string, unknown>>) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

describe("matchCurriculumOutcomes", () => {
  it("returns empty when query text has no usable tokens", async () => {
    const result = await matchCurriculumOutcomes({ topicHint: "ab" }, mockPool([]) as never);
    expect(result).toEqual([]);
  });

  it("scores and sorts outcomes from database rows", async () => {
    const client = mockPool([
      {
        outcome_code: "M.5.1.1",
        outcome_title: "Polinomlar ve çarpanlara ayırma",
        unit_slug: "cebir",
        unit_title: "Polinomlar",
        branch_slug: "matematik",
        branch_name: "Matematik",
        grade_level: 8,
      },
      {
        outcome_code: "M.5.1.2",
        outcome_title: "Oran orantı problemleri",
        unit_slug: "oran",
        unit_title: "Oran Orantı",
        branch_slug: "matematik",
        branch_name: "Matematik",
        grade_level: 8,
      },
    ]);

    const result = await matchCurriculumOutcomes(
      {
        ocrText: "Polinom sorusu çarpanlara ayırma",
        topicHint: "Polinomlar",
        branchSlug: "matematik",
        gradeLevel: 8,
      },
      client as never,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].outcomeTitle.toLocaleLowerCase("tr-TR")).toContain("polinom");
    expect(result[0].matchScore).toBeGreaterThan(0);
  });

  it("returns empty when curriculum table is missing", async () => {
    const client = {
      query: vi.fn().mockRejectedValue(Object.assign(new Error("missing"), { code: "42P01" })),
    };
    const result = await matchCurriculumOutcomes({ topicHint: "Paragraf ana düşünce" }, client as never);
    expect(result).toEqual([]);
  });

  it("returns empty when database is unreachable in tests", async () => {
    const client = {
      query: vi.fn().mockRejectedValue(Object.assign(new Error("refused"), { code: "ECONNREFUSED" })),
    };
    const result = await matchCurriculumOutcomes({ topicHint: "Fizik hareket" }, client as never);
    expect(result).toEqual([]);
  });
});
