/** Kamuya açık canonical ve Open Graph için kök URL (sonunda `/` yok). */
export function publicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  );
}
