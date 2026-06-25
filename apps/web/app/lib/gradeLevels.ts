/** Öğrenci sınıf seviyesi (1–12) — kayıt ve video filtreleri */
export const GRADE_LEVEL_OPTIONS = [
  { value: 1, label: "1. sınıf" },
  { value: 2, label: "2. sınıf" },
  { value: 3, label: "3. sınıf" },
  { value: 4, label: "4. sınıf" },
  { value: 5, label: "5. sınıf" },
  { value: 6, label: "6. sınıf" },
  { value: 7, label: "7. sınıf" },
  { value: 8, label: "8. sınıf (LGS)" },
  { value: 9, label: "9. sınıf" },
  { value: 10, label: "10. sınıf" },
  { value: 11, label: "11. sınıf" },
  { value: 12, label: "12. sınıf (YKS)" },
] as const;

export function gradeLevelLabel(level: number | null | undefined): string {
  if (level == null) return "Sınıf seçilmedi";
  return GRADE_LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? `${level}. sınıf`;
}

/** YouTube / Vimeo dış bağlantısını gömülebilir iframe src yapar */
export function embedVideoUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let id = u.searchParams.get("v");
      if (!id && u.hostname.includes("youtu.be")) id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return raw;
  } catch {
    return null;
  }
}
