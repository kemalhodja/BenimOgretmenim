import { describe, expect, it } from "vitest";
import {
  loadStaticCurriculumOutcomes,
  resolveCurriculumBranchSlug,
} from "./lessonVideoCatalog.js";

describe("resolveCurriculumBranchSlug", () => {
  it("maps generic matematik to ortaokul-matematik for grade 8", () => {
    expect(resolveCurriculumBranchSlug("matematik", 8)).toBe("ortaokul-matematik");
  });

  it("keeps lise matematik slug for grade 11", () => {
    expect(resolveCurriculumBranchSlug("matematik", 11)).toBe("matematik");
  });
});

describe("loadStaticCurriculumOutcomes", () => {
  it("returns static outcomes for known grade and branch", () => {
    const slug = resolveCurriculumBranchSlug("matematik", 8);
    const outcomes = loadStaticCurriculumOutcomes(8, slug);
    expect(outcomes.length).toBeGreaterThan(0);
    expect(outcomes.every((o) => o.gradeLevel === 8 && o.branchSlug === slug)).toBe(true);
    expect(outcomes[0].outcomeCode.length).toBeGreaterThan(0);
  });

  it("filters static outcomes by topic", () => {
    const slug = resolveCurriculumBranchSlug("matematik", 8);
    const all = loadStaticCurriculumOutcomes(8, slug);
    const filtered = loadStaticCurriculumOutcomes(8, slug, all[0]?.unitTitle.slice(0, 4) ?? "ünite");
    expect(filtered.length).toBeLessThanOrEqual(all.length);
  });
});
