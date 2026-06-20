import { pool } from "../db.js";
import { formatDbConnectError } from "../lib/dbErrors.js";

const DEMO_ITEMS = [
  {
    title: "TYT türev: zincir kuralını hatırla",
    contentKind: "tip",
    branchSlug: "matematik",
    targetExam: "TYT",
  },
  {
    title: "LGS kesirler: paydaları eşitlemeden toplama yapma",
    contentKind: "tip",
    branchSlug: "matematik",
    targetExam: "LGS",
  },
  {
    title: "Paragrafta ana fikir — son cümleye bak",
    contentKind: "formula",
    branchSlug: "turkce",
    targetExam: "TYT",
  },
  {
    title: "İngilizce: günlük 5 dakika konuşma pratiği",
    contentKind: "video",
    branchSlug: "ingilizce",
    targetExam: null,
    externalUrl: null,
  },
] as const;

async function tableExists(table: string): Promise<boolean> {
  const r = await pool.query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [`public.${table}`],
  );
  return r.rows[0]?.exists === true;
}

async function main() {
  try {
    if (!(await tableExists("teacher_zigo_content_links"))) {
      console.log("teacher_zigo_content_links yok — önce migration 061 uygulayın.");
      await pool.end();
      return;
    }

    const existing = await pool.query<{ count: string }>(
      `select count(*)::text as count from teacher_zigo_content_links`,
    );
    if (Number(existing.rows[0]?.count ?? 0) > 0) {
      console.log("Zigo vitrin zaten dolu; seed atlandı.");
      await pool.end();
      return;
    }

    const teacher = await pool.query<{ id: string }>(
      `select t.id
       from teachers t
       order by case when t.verification_status = 'verified' then 0 else 1 end, t.created_at
       limit 1`,
    );
    if (!teacher.rowCount) {
      console.log("Öğretmen profili yok; önce db:seed çalıştırın.");
      await pool.end();
      return;
    }

    const teacherId = teacher.rows[0].id;
    for (const item of DEMO_ITEMS) {
      await pool.query(
        `insert into teacher_zigo_content_links (
           teacher_id, title, content_kind, external_url, branch_slug, target_exam
         ) values ($1, $2, $3, $4, $5, $6)`,
        [
          teacherId,
          item.title,
          item.contentKind,
          "externalUrl" in item ? item.externalUrl : null,
          item.branchSlug,
          item.targetExam,
        ],
      );
    }

    console.log(`Zigo vitrin: ${DEMO_ITEMS.length} demo içerik eklendi (teacher_id=${teacherId}).`);
    await pool.end();
  } catch (e) {
    console.error(formatDbConnectError(e));
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(formatDbConnectError(err));
  process.exit(1);
});
