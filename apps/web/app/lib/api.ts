import { makeRequestId } from "./requestId";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002";

/** Sunucu tarafı `fetch` ve tam URL gerektiren yerler için (SSR, `fiyatlar` vb.). */
export function getServerApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:3002"
  ).replace(/\/$/, "");
}

function resolveApiFetchUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const upstream = getServerApiBaseUrl();

  if (typeof window !== "undefined" && p.startsWith("/v1")) {
    return p;
  }
  return `${upstream}${p}`;
}

export type ApiError = { error: unknown } | { error: string } | unknown;

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const url = resolveApiFetchUrl(path);
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", makeRequestId());
  }
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (init?.token) {
    headers.set("authorization", `Bearer ${init.token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const responseRequestId = res.headers.get("x-request-id") ?? undefined;

  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      const preview = text.slice(0, 80).replace(/\s+/g, " ");
      const ridSuffix = responseRequestId ? ` (requestId=${responseRequestId})` : "";
      throw new Error(
        `[${res.status}] expected_json_got_${contentType || "unknown"} (${preview}). ` +
          `API uçlarına yanlış adres gidiyor olabilir: Render Web'de NEXT_PUBLIC_API_BASE_URL gerçek API kökü olmalı; ` +
          `aynı site köküne işaret ediyorsa Next.js HTML döner. INTERNAL_API_BASE_URL ve /v1 rewrite ile de düzeltilebilir.${ridSuffix}`,
      );
    }
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" && json && "error" in json
        ? (json as { error?: unknown }).error
        : json;
    const bodyRid =
      typeof json === "object" && json && "requestId" in json
        ? (json as { requestId?: unknown }).requestId
        : undefined;
    const rid =
      typeof bodyRid === "string" && bodyRid
        ? bodyRid
        : responseRequestId;
    const ridSuffix = rid ? ` (requestId=${rid})` : "";
    throw new Error(
      `[${res.status}] ${typeof msg === "string" ? msg : "request_failed"}${ridSuffix}`,
    );
  }

  return json as T;
}

