import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyHomeworkPost,
  homeworkResolveMinutes,
  homeworkRoutingPriorityFromMetadata,
  homeworkSatisfactionRewardMinor,
  homeworkTargetMinutesForUrgency,
  releaseExpiredHomeworkClaims,
  scoreHomeworkAnswer,
} from "./homeworkPosts.js";

describe("homeworkResolveMinutes", () => {
  afterEach(() => {
    delete process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES;
  });

  it("defaults to 20 when env unset", () => {
    delete process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES;
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("uses valid integer env", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "45";
    expect(homeworkResolveMinutes()).toBe(45);
  });

  it("floors decimal env", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "30.9";
    expect(homeworkResolveMinutes()).toBe(30);
  });

  it("rejects below 1", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "0";
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("rejects above 24h", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = String(24 * 60 + 1);
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("rejects NaN", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "x";
    expect(homeworkResolveMinutes()).toBe(20);
  });

  it("accepts max boundary 24h", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = String(24 * 60);
    expect(homeworkResolveMinutes()).toBe(24 * 60);
  });
});

describe("homeworkSatisfactionRewardMinor", () => {
  afterEach(() => {
    delete process.env.HOMEWORK_SATISFACTION_REWARD_MINOR;
  });

  it("defaults to 1000 minor (10 TL) when unset", () => {
    delete process.env.HOMEWORK_SATISFACTION_REWARD_MINOR;
    expect(homeworkSatisfactionRewardMinor()).toBe(1000);
  });

  it("uses valid env", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "2500";
    expect(homeworkSatisfactionRewardMinor()).toBe(2500);
  });

  it("rejects zero", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "0";
    expect(homeworkSatisfactionRewardMinor()).toBe(1000);
  });

  it("rejects above cap", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "1000001";
    expect(homeworkSatisfactionRewardMinor()).toBe(1000);
  });

  it("accepts max cap", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "1000000";
    expect(homeworkSatisfactionRewardMinor()).toBe(1_000_000);
  });

  it("floors decimal", () => {
    process.env.HOMEWORK_SATISFACTION_REWARD_MINOR = "1500.7";
    expect(homeworkSatisfactionRewardMinor()).toBe(1500);
  });
});

describe("homeworkTargetMinutesForUrgency", () => {
  afterEach(() => {
    delete process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES;
  });

  it("uses configured default duration for normal urgency", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "35";
    expect(homeworkTargetMinutesForUrgency("normal")).toBe(35);
  });

  it("uses fixed shorter SLA for priority urgency", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "45";
    expect(homeworkTargetMinutesForUrgency("priority")).toBe(15);
  });

  it("uses fixed shortest SLA for urgent questions", () => {
    process.env.HOMEWORK_CLAIM_RESOLVE_MINUTES = "45";
    expect(homeworkTargetMinutesForUrgency("urgent")).toBe(10);
  });
});

describe("releaseExpiredHomeworkClaims", () => {
  it("returns rowCount when set", async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rowCount: 4 }),
    };
    await expect(releaseExpiredHomeworkClaims(db as import("pg").Pool)).resolves.toBe(4);
    expect(db.query).toHaveBeenCalledTimes(1);
    const sql = String(db.query.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("student_homework_posts");
    expect(sql).toContain("resolve_deadline_at");
  });

  it("returns 0 when rowCount missing", async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rowCount: undefined }),
    };
    await expect(releaseExpiredHomeworkClaims(db as import("pg").Pool)).resolves.toBe(0);
  });
});

describe("homework AI helpers", () => {
  afterEach(() => {
    delete process.env.HOMEWORK_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.HOMEWORK_STORAGE_PROVIDER;
  });

  it("classifies homework with heuristic metadata when provider is not configured", async () => {
    const r = await classifyHomeworkPost({
      branchId: 12,
      topic: "Oran orantı",
      helpText: "Bu problemi nasıl kuracağımı anlamadım.",
      gradeLevelText: "8. sınıf",
      targetExam: "LGS",
      learningObjective: "Problem çözme",
      urgencyLevel: "urgent",
      imageUrls: ["data:image/jpeg;base64,abcd"],
    });
    expect(r.storageBackend).toBe("inline_data_url_pending_object_storage");
    expect(r.aiMetadata.provider).toBe("heuristic_v2");
    expect(r.aiMetadata.estimated_solution_minutes).toBe(10);
    expect(r.aiMetadata.routing_priority).toBeGreaterThanOrEqual(60);
    expect(r.aiMetadata.content_quality).toBe("medium");
    expect(r.aiMetadata.needs_clarification).toBe(false);
    expect(r.aiMetadata.recommended_teacher_tags).toEqual(
      expect.arrayContaining(["LGS deneyimi", "8. sınıf seviyesi", "görsel çözüm"]),
    );
    expect(r.aiMetadata.similar_practice).toEqual(expect.arrayContaining([expect.stringContaining("Oran orantı")]));
    expect(Array.isArray(r.aiMetadata.matched_curriculum_outcomes)).toBe(true);
    expect(r.aiMetadata).toHaveProperty("primary_outcome");
  });

  it("flags short text-only posts as needing clarification with lower routing priority", async () => {
    const r = await classifyHomeworkPost({
      branchId: 3,
      topic: "Denklem",
      helpText: "yardım",
      urgencyLevel: "normal",
      imageUrls: [],
    });
    expect(r.aiMetadata.needs_clarification).toBe(true);
    expect(r.aiMetadata.content_quality).toBe("low");
    expect(r.aiMetadata.routing_priority).toBeLessThan(50);
    expect(r.aiMetadata.routing_note).toContain("netleştirme");
  });

  it("clamps routing priority from metadata", () => {
    expect(homeworkRoutingPriorityFromMetadata({ routing_priority: 150 })).toBe(100);
    expect(homeworkRoutingPriorityFromMetadata({ routing_priority: -5 })).toBe(0);
    expect(homeworkRoutingPriorityFromMetadata(null)).toBe(50);
  });

  it("scores homework answers on a 0-100 heuristic scale without provider", async () => {
    const r = await scoreHomeworkAnswer({
      answerText: "Önce verilenleri yazalım. Çünkü oran aynı kalır, adım adım çapraz çarpım yapıp sonucu kontrol ederiz.",
      answerImageUrls: ["https://example.com/solution.png"],
      answerVideoUrl: null,
    });
    expect(r.qualityScore).toBeGreaterThanOrEqual(35);
    expect(r.qualityScore).toBeLessThanOrEqual(100);
    expect(r.quality.source).toBe("heuristic_v1");
    expect((r.quality.rubric as { visual_support?: number }).visual_support).toBe(15);
  });
});
