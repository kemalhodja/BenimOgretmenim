import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";

type Db = Pool | PoolClient;

export type MatchedCurriculumOutcome = {
  outcomeCode: string;
  outcomeTitle: string;
  unitSlug: string;
  unitTitle: string;
  branchSlug: string;
  branchName: string;
  gradeLevel: number;
  matchScore: number;
};

function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 12);
}

function scoreMatch(queryTokens: string[], outcomeTitle: string, unitTitle: string): number {
  const hay = `${outcomeTitle} ${unitTitle}`.toLocaleLowerCase("tr-TR");
  let score = 0;
  for (const token of queryTokens) {
    if (hay.includes(token)) score += 10;
  }
  if (queryTokens.some((t) => outcomeTitle.toLocaleLowerCase("tr-TR").includes(t))) score += 15;
  return score;
}

export async function matchCurriculumOutcomes(
  input: {
    ocrText?: string;
    topicHint?: string;
    branchSlug?: string | null;
    gradeLevel?: number | null;
    targetExam?: string | null;
    limit?: number;
  },
  client: Db = pool,
): Promise<MatchedCurriculumOutcome[]> {
  const combined = [input.ocrText, input.topicHint, input.targetExam].filter(Boolean).join(" ");
  const tokens = tokenize(combined);
  if (!tokens.length) return [];

  const limit = Math.min(8, Math.max(1, input.limit ?? 5));
  const patterns = tokens.slice(0, 6).map((t) => `%${t}%`);
  const conditions = [
    `status = 'published'`,
    `(outcome_title ilike any($1::text[]) or unit_title ilike any($1::text[]))`,
  ];
  const args: unknown[] = [patterns];
  let idx = 2;
  if (input.branchSlug) {
    conditions.push(`branch_slug = $${idx++}`);
    args.push(input.branchSlug);
  }
  if (input.gradeLevel) {
    conditions.push(`grade_level = $${idx++}`);
    args.push(input.gradeLevel);
  }
  args.push(limit);

  try {
    const r = await client.query(
      `select outcome_code, outcome_title, unit_slug, unit_title,
              branch_slug, branch_name, grade_level
       from curriculum_test_questions
       where ${conditions.join(" and ")}
       limit $${idx}`,
      args,
    );

    return (r.rows as Array<Record<string, unknown>>)
      .map((row) => ({
        outcomeCode: String(row.outcome_code),
        outcomeTitle: String(row.outcome_title),
        unitSlug: String(row.unit_slug),
        unitTitle: String(row.unit_title),
        branchSlug: String(row.branch_slug),
        branchName: String(row.branch_name),
        gradeLevel: Number(row.grade_level),
        matchScore: scoreMatch(tokens, String(row.outcome_title), String(row.unit_title)),
      }))
      .filter((row) => row.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "42P01" || err.code === "ECONNREFUSED") return [];
    throw e;
  }
}

export async function matchCurriculumWithTrgm(
  input: { queryText: string; branchSlug?: string | null; limit?: number },
  client: Db = pool,
): Promise<MatchedCurriculumOutcome[]> {
  const q = input.queryText.trim().slice(0, 500);
  if (q.length < 4) return [];
  try {
    const args: unknown[] = [q];
    let branchFilter = "";
    if (input.branchSlug) {
      args.unshift(input.branchSlug);
      branchFilter = `and branch_slug = $1`;
    }
    const qParam = input.branchSlug ? 2 : 1;
    const limitParam = input.branchSlug ? 3 : 2;
    args.push(Math.min(8, input.limit ?? 5));

    const r = await client.query(
      `select outcome_code, outcome_title, unit_slug, unit_title,
              branch_slug, branch_name, grade_level,
              greatest(similarity(outcome_title, $${qParam}), similarity(unit_title, $${qParam})) as sim
       from curriculum_test_questions
       where status = 'published'
         ${branchFilter}
         and (outcome_title % $${qParam} or unit_title % $${qParam})
       order by sim desc
       limit $${limitParam}`,
      args,
    );
    return r.rows.map((row) => ({
      outcomeCode: String(row.outcome_code),
      outcomeTitle: String(row.outcome_title),
      unitSlug: String(row.unit_slug),
      unitTitle: String(row.unit_title),
      branchSlug: String(row.branch_slug),
      branchName: String(row.branch_name),
      gradeLevel: Number(row.grade_level),
      matchScore: Math.round(Number(row.sim) * 100),
    }));
  } catch {
    return matchCurriculumOutcomes(
      { topicHint: input.queryText, branchSlug: input.branchSlug, limit: input.limit },
      client,
    );
  }
}
