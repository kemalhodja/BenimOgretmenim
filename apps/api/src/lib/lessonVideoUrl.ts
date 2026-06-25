const ALLOWED_HOST_SUFFIXES = ["youtube.com", "youtu.be", "vimeo.com"] as const;

/** HTTPS ve desteklenen video host kontrolü */
export function isAllowedLessonVideoUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

/** Kayıt öncesi YouTube/Vimeo URL'lerini standart forma getirir */
export function normalizeLessonVideoUrl(raw: string): string | null {
  if (!isAllowedLessonVideoUrl(raw)) return null;
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (!id) return null;
      return `https://www.youtube.com/watch?v=${id}`;
    }

    if (host.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/watch?v=${v}`;
    }

    if (host.includes("vimeo.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) return `https://vimeo.com/${id}`;
    }

    return u.toString();
  } catch {
    return null;
  }
}
