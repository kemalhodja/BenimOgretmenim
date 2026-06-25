import { pool } from "../db.js";
import { STATIC_CURRICULUM_QUESTIONS } from "./curriculumTests.js";

export type CurriculumOutcomeOption = {
  outcomeCode: string;
  outcomeTitle: string;
  unitTitle: string;
  branchSlug: string;
  branchName: string;
  gradeLevel: number;
};

function isMissingRelation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "42P01";
}

/** Platform branş slug → müfredat kataloğu slug (ör. matematik + 8. sınıf → ortaokul-matematik). */
export function resolveCurriculumBranchSlug(branchSlug: string, gradeLevel: number): string {
  if (branchSlug.startsWith("ilkokul-") || branchSlug.startsWith("ortaokul-")) {
    return branchSlug;
  }
  const stage = gradeLevel <= 4 ? "ilkokul" : gradeLevel <= 8 ? "ortaokul" : null;
  if (!stage) return branchSlug;
  const staged = `${stage}-${branchSlug}`;
  if (staticOutcomes(gradeLevel, staged, null).length > 0) return staged;
  return branchSlug;
}

function staticOutcomes(
  gradeLevel: number,
  branchSlug: string,
  topic: string | null,
): CurriculumOutcomeOption[] {
  const seen = new Set<string>();
  const out: CurriculumOutcomeOption[] = [];
  for (const q of STATIC_CURRICULUM_QUESTIONS) {
    if (q.gradeLevel !== gradeLevel || q.branchSlug !== branchSlug) continue;
    if (topic) {
      const hay = `${q.unitTitle} ${q.outcomeTitle} ${q.outcomeCode}`.toLowerCase();
      if (!hay.includes(topic.toLowerCase())) continue;
    }
    const key = `${q.outcomeCode}:${q.outcomeTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      outcomeCode: q.outcomeCode,
      outcomeTitle: q.outcomeTitle,
      unitTitle: q.unitTitle,
      branchSlug: q.branchSlug,
      branchName: q.branchName,
      gradeLevel: q.gradeLevel,
    });
    if (out.length >= 50) break;
  }
  return out.sort((a, b) => a.unitTitle.localeCompare(b.unitTitle, "tr-TR") || a.outcomeCode.localeCompare(b.outcomeCode));
}

/** Static curriculum fallback — exported for unit tests and offline tooling. */
export function loadStaticCurriculumOutcomes(
  gradeLevel: number,
  branchSlug: string,
  topic?: string | null,
): CurriculumOutcomeOption[] {
  return staticOutcomes(gradeLevel, branchSlug, topic?.trim() || null);
}

export async function loadCurriculumOutcomes(args: {
  gradeLevel: number;
  branchSlug: string;
  topic?: string | null;
}): Promise<CurriculumOutcomeOption[]> {
  const topic = args.topic?.trim() || null;
  const branchSlug = resolveCurriculumBranchSlug(args.branchSlug, args.gradeLevel);
  try {
    const params: unknown[] = [args.gradeLevel, branchSlug];
    let topicFilter = "";
    if (topic) {
      params.push(`%${topic}%`);
      topicFilter = `and (unit_title ilike $3 or outcome_title ilike $3 or outcome_code ilike $3)`;
    }
    const r = await pool.query<{
      outcome_code: string;
      outcome_title: string;
      unit_title: string;
      branch_slug: string;
      branch_name: string;
      grade_level: number;
    }>(
      `select distinct outcome_code, outcome_title, unit_title, branch_slug, branch_name, grade_level
       from curriculum_test_questions
       where status = 'published'
         and grade_level = $1
         and branch_slug = $2
         ${topicFilter}
       order by unit_title, outcome_code
       limit 50`,
      params,
    );
    if (r.rows.length > 0) {
      return r.rows.map((row) => ({
        outcomeCode: row.outcome_code,
        outcomeTitle: row.outcome_title,
        unitTitle: row.unit_title,
        branchSlug: row.branch_slug,
        branchName: row.branch_name,
        gradeLevel: Number(row.grade_level),
      }));
    }
  } catch (e) {
    if (!isMissingRelation(e)) throw e;
  }
  return loadStaticCurriculumOutcomes(args.gradeLevel, branchSlug, topic);
}
