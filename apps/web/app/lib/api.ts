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

  if (
    typeof window !== "undefined" &&
    (p.startsWith("/v1") || p.startsWith("/api/admin"))
  ) {
    return p;
  }
  return `${upstream}${p}`;
}

export type ApiError = { error: unknown } | { error: string } | unknown;

/** API `error` alanı string değilse (ör. Zod flatten) kısa metin üretir. */
function errorDetailForThrow(msg: unknown): string {
  if (typeof msg === "string") return msg;
  if (msg && typeof msg === "object") {
    const o = msg as { fieldErrors?: Record<string, unknown> };
    if (o.fieldErrors && typeof o.fieldErrors === "object") {
      for (const [key, val] of Object.entries(o.fieldErrors)) {
        if (Array.isArray(val) && val.length) {
          const first = val[0];
          if (typeof first === "string") return `validation:${key}:${first}`;
        }
      }
    }
    try {
      return JSON.stringify(msg).slice(0, 400);
    } catch {
      return "request_failed";
    }
  }
  return "request_failed";
}

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
    const detail = errorDetailForThrow(msg);
    throw new Error(`[${res.status}] ${detail}${ridSuffix}`);
  }

  return json as T;
}

