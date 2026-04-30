import type { PoolClient } from "pg";

type IlceRow = {
  il_plaka: number;
  ilce_adi: string;
};

function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    Ç: "C",
    Ğ: "G",
    İ: "I",
    I: "I",
    Ö: "O",
    Ş: "S",
    Ü: "U",
    ç: "c",
    ğ: "g",
    ı: "i",
    i: "i",
    ö: "o",
    ş: "s",
    ü: "u",
  };
  const ascii = input
    .trim()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const TR_CITIES: Array<{ name: string; slug: string; plate: number }> = [
  { name: "Adana", slug: "adana", plate: 1 },
  { name: "Adıyaman", slug: "adiyaman", plate: 2 },
  { name: "Afyonkarahisar", slug: "afyonkarahisar", plate: 3 },
  { name: "Ağrı", slug: "agri", plate: 4 },
  { name: "Amasya", slug: "amasya", plate: 5 },
  { name: "Ankara", slug: "ankara", plate: 6 },
  { name: "Antalya", slug: "antalya", plate: 7 },
  { name: "Artvin", slug: "artvin", plate: 8 },
  { name: "Aydın", slug: "aydin", plate: 9 },
  { name: "Balıkesir", slug: "balikesir", plate: 10 },
  { name: "Bilecik", slug: "bilecik", plate: 11 },
  { name: "Bingöl", slug: "bingol", plate: 12 },
  { name: "Bitlis", slug: "bitlis", plate: 13 },
  { name: "Bolu", slug: "bolu", plate: 14 },
  { name: "Burdur", slug: "burdur", plate: 15 },
  { name: "Bursa", slug: "bursa", plate: 16 },
  { name: "Çanakkale", slug: "canakkale", plate: 17 },
  { name: "Çankırı", slug: "cankiri", plate: 18 },
  { name: "Çorum", slug: "corum", plate: 19 },
  { name: "Denizli", slug: "denizli", plate: 20 },
  { name: "Diyarbakır", slug: "diyarbakir", plate: 21 },
  { name: "Edirne", slug: "edirne", plate: 22 },
  { name: "Elazığ", slug: "elazig", plate: 23 },
  { name: "Erzincan", slug: "erzincan", plate: 24 },
  { name: "Erzurum", slug: "erzurum", plate: 25 },
  { name: "Eskişehir", slug: "eskisehir", plate: 26 },
  { name: "Gaziantep", slug: "gaziantep", plate: 27 },
  { name: "Giresun", slug: "giresun", plate: 28 },
  { name: "Gümüşhane", slug: "gumushane", plate: 29 },
  { name: "Hakkâri", slug: "hakkari", plate: 30 },
  { name: "Hatay", slug: "hatay", plate: 31 },
  { name: "Isparta", slug: "isparta", plate: 32 },
  { name: "Mersin", slug: "mersin", plate: 33 },
  { name: "İstanbul", slug: "istanbul", plate: 34 },
  { name: "İzmir", slug: "izmir", plate: 35 },
  { name: "Kars", slug: "kars", plate: 36 },
  { name: "Kastamonu", slug: "kastamonu", plate: 37 },
  { name: "Kayseri", slug: "kayseri", plate: 38 },
  { name: "Kırklareli", slug: "kirklareli", plate: 39 },
  { name: "Kırşehir", slug: "kirsehir", plate: 40 },
  { name: "Kocaeli", slug: "kocaeli", plate: 41 },
  { name: "Konya", slug: "konya", plate: 42 },
  { name: "Kütahya", slug: "kutahya", plate: 43 },
  { name: "Malatya", slug: "malatya", plate: 44 },
  { name: "Manisa", slug: "manisa", plate: 45 },
  { name: "Kahramanmaraş", slug: "kahramanmaras", plate: 46 },
  { name: "Mardin", slug: "mardin", plate: 47 },
  { name: "Muğla", slug: "mugla", plate: 48 },
  { name: "Muş", slug: "mus", plate: 49 },
  { name: "Nevşehir", slug: "nevsehir", plate: 50 },
  { name: "Niğde", slug: "nigde", plate: 51 },
  { name: "Ordu", slug: "ordu", plate: 52 },
  { name: "Rize", slug: "rize", plate: 53 },
  { name: "Sakarya", slug: "sakarya", plate: 54 },
  { name: "Samsun", slug: "samsun", plate: 55 },
  { name: "Siirt", slug: "siirt", plate: 56 },
  { name: "Sinop", slug: "sinop", plate: 57 },
  { name: "Sivas", slug: "sivas", plate: 58 },
  { name: "Tekirdağ", slug: "tekirdag", plate: 59 },
  { name: "Tokat", slug: "tokat", plate: 60 },
  { name: "Trabzon", slug: "trabzon", plate: 61 },
  { name: "Tunceli", slug: "tunceli", plate: 62 },
  { name: "Şanlıurfa", slug: "sanliurfa", plate: 63 },
  { name: "Uşak", slug: "usak", plate: 64 },
  { name: "Van", slug: "van", plate: 65 },
  { name: "Yozgat", slug: "yozgat", plate: 66 },
  { name: "Zonguldak", slug: "zonguldak", plate: 67 },
  { name: "Aksaray", slug: "aksaray", plate: 68 },
  { name: "Bayburt", slug: "bayburt", plate: 69 },
  { name: "Karaman", slug: "karaman", plate: 70 },
  { name: "Kırıkkale", slug: "kirikkale", plate: 71 },
  { name: "Batman", slug: "batman", plate: 72 },
  { name: "Şırnak", slug: "sirnak", plate: 73 },
  { name: "Bartın", slug: "bartin", plate: 74 },
  { name: "Ardahan", slug: "ardahan", plate: 75 },
  { name: "Iğdır", slug: "igdir", plate: 76 },
  { name: "Yalova", slug: "yalova", plate: 77 },
  { name: "Karabük", slug: "karabuk", plate: 78 },
  { name: "Kilis", slug: "kilis", plate: 79 },
  { name: "Osmaniye", slug: "osmaniye", plate: 80 },
  { name: "Düzce", slug: "duzce", plate: 81 },
];

const DISTRICTS_JSON_URL =
  "https://gist.githubusercontent.com/mebaysan/b9f3cc1ad9c1f4294a0a7c7a7be9ec62/raw/ilceler.json";

export async function seedTurkeyGeoIfNeeded(client: PoolClient): Promise<void> {
  // Eğer ilçeler zaten yüklüyse (yaklaşık 973), tekrar fetch + insert yapmayalım.
  const cnt = await client.query(`select count(*)::int as n from districts`);
  const n = Number((cnt.rows[0] as { n: number }).n);
  if (Number.isFinite(n) && n >= 950) {
    console.log("[seed:tr-geo] districts already seeded:", n);
    return;
  }

  console.log("[seed:tr-geo] seeding cities…");
  for (const c of TR_CITIES) {
    await client.query(
      `insert into cities (name, slug, plate_code)\n       values ($1, $2, $3)\n       on conflict (slug) do update set name = excluded.name, plate_code = excluded.plate_code`,
      [c.name, c.slug, c.plate],
    );
  }

  const cityMapQ = await client.query(
    `select id::int, plate_code::int from cities where plate_code is not null`,
  );
  const plateToCityId = new Map<number, number>();
  for (const row of cityMapQ.rows as Array<{ id: number; plate_code: number }>) {
    if (row.plate_code) plateToCityId.set(Number(row.plate_code), Number(row.id));
  }

  console.log("[seed:tr-geo] fetching districts json…");
  const res = await fetch(DISTRICTS_JSON_URL, {
    headers: { "user-agent": "benimogretmenim/seed-tr-geo" },
  });
  if (!res.ok) {
    throw new Error(`[seed:tr-geo] fetch failed: ${res.status}`);
  }
  const rows = (await res.json()) as IlceRow[];
  if (!Array.isArray(rows) || rows.length < 500) {
    throw new Error("[seed:tr-geo] invalid districts json");
  }

  console.log("[seed:tr-geo] inserting districts…", rows.length);
  const batchSize = 250;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const cityIds: number[] = [];
    const names: string[] = [];
    const slugs: string[] = [];
    for (const d of batch) {
      const cityId = plateToCityId.get(Number(d.il_plaka));
      if (!cityId) continue;
      const name = String(d.ilce_adi ?? "").trim();
      if (!name) continue;
      const slug = slugifyTr(name);
      if (!slug) continue;
      cityIds.push(cityId);
      names.push(name);
      slugs.push(slug);
    }
    if (!cityIds.length) continue;
    await client.query(
      `insert into districts (city_id, name, slug)\n       select * from unnest($1::int[], $2::text[], $3::text[])\n       on conflict (city_id, slug) do update set name = excluded.name`,
      [cityIds, names, slugs],
    );
  }

  const cnt2 = await client.query(`select count(*)::int as n from districts`);
  console.log("[seed:tr-geo] done; districts:", (cnt2.rows[0] as { n: number }).n);
}

