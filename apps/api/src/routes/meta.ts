import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";

export const meta = new Hono();

/** Branş ağacı (filtre / kayıt formları) */
meta.get("/branches", async (c) => {
  const r = await pool.query(
    `select id, parent_id, name, slug, sort_order, is_active
     from branches
     where is_active = true
     order by parent_id nulls first, sort_order, name`,
  );
  return c.json({ branches: r.rows });
});

meta.get("/cities", async (c) => {
  const r = await pool.query(
    `select id, name, slug, plate_code from cities order by name`,
  );
  return c.json({ cities: r.rows });
});

/** İlçeler (öğretmen konumu formu) — cityId zorunlu */
meta.get("/districts", async (c) => {
  const q = z.coerce.number().int().positive().safeParse(c.req.query("cityId"));
  if (!q.success) {
    return c.json({ error: "invalid_or_missing_cityId" }, 400);
  }
  const r = await pool.query(
    `select id, city_id, name, slug
     from districts
     where city_id = $1
     order by name`,
    [q.data],
  );
  return c.json({ districts: r.rows });
});
