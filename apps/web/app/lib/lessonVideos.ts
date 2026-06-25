export type VideoKind = "lesson" | "exam_prep";

export function videoKindLabel(kind: VideoKind): string {
  return kind === "exam_prep" ? "Sınav hazırlık" : "Ders videosu";
}

export function isAllowedVideoHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("vimeo.com")
    );
  } catch {
    return false;
  }
}
