import { describe, expect, it } from "vitest";
import { parseWeakTopicTokens, rankVideosForWeakTopics, scoreVideoForWeakTopics } from "./lessonVideoSuggestions.js";

describe("lessonVideoSuggestions", () => {
  it("parses comma-separated weak topics", () => {
    expect(parseWeakTopicTokens("Üslü, Paragraf; kesir")).toEqual(["üslü", "paragraf", "kesir"]);
    expect(parseWeakTopicTokens("ab, paragraf")).toEqual(["paragraf"]);
  });

  it("scores videos by topic overlap", () => {
    const score = scoreVideoForWeakTopics(
      {
        topicTitle: "Üslü sayılar",
        outcomeTitle: "Üslü ifadeleri yorumlar",
        outcomeCode: "M.8.1.1",
        title: "8. sınıf üslü sayılar",
        branchName: "Matematik",
      },
      ["üslü"],
    );
    expect(score).toBeGreaterThan(0);
  });

  it("ranks matching videos highest", () => {
    const ranked = rankVideosForWeakTopics(
      [
        {
          topicTitle: "Paragraf",
          outcomeTitle: "Ana fikir",
          outcomeCode: "T.8.1",
          title: "Türkçe paragraf",
          branchName: "Türkçe",
        },
        {
          topicTitle: "Üslü sayılar",
          outcomeTitle: "Üslü ifadeler",
          outcomeCode: "M.8.1",
          title: "Matematik üslü",
          branchName: "Matematik",
        },
      ],
      ["üslü"],
      2,
    );
    expect(ranked[0]?.title).toContain("üslü");
  });
});
