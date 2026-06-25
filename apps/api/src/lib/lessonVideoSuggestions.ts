export type ScorableVideo = {
  topicTitle: string;
  outcomeTitle: string;
  outcomeCode: string;
  title: string;
  branchName: string;
  createdAt?: string | Date | null;
};

export function parseWeakTopicTokens(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const token = part.trim().toLocaleLowerCase("tr-TR");
    if (token.length < 3 || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= 8) break;
  }
  return out;
}

export function scoreVideoForWeakTopics(video: ScorableVideo, topics: string[]): number {
  if (!topics.length) return 0;
  const hay = `${video.topicTitle} ${video.outcomeTitle} ${video.outcomeCode} ${video.title} ${video.branchName}`.toLocaleLowerCase(
    "tr-TR",
  );
  let score = 0;
  for (const topic of topics) {
    if (hay.includes(topic)) score += 10;
    else if (topic.length >= 5 && hay.split(/\s+/).some((word) => word.startsWith(topic.slice(0, 5)))) {
      score += 4;
    }
  }
  return score;
}

export function rankVideosForWeakTopics<T extends ScorableVideo>(
  videos: T[],
  topics: string[],
  limit = 5,
): Array<T & { matchScore: number }> {
  if (!topics.length) return [];
  return videos
    .map((video) => ({ video, score: scoreVideoForWeakTopics(video, topics) }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(b.video.createdAt ?? "").localeCompare(String(a.video.createdAt ?? "")),
    )
    .slice(0, limit)
    .map((row) => ({ ...row.video, matchScore: row.score }));
}
