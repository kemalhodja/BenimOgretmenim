import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, internalApiBase } from "../_upstream";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const source = new URL(req.url);
  const upstream = new URL(`${internalApiBase()}/v1/admin/funnel/summary`);
  const days = source.searchParams.get("days");
  if (days) upstream.searchParams.set("days", days);

  const res = await fetch(upstream, {
    method: "GET",
    headers: adminProxyHeaders(req),
    cache: "no-store",
  });
  const text = await res.text();
  const rid = res.headers.get("x-request-id");
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8",
      ...(rid ? { "x-request-id": rid } : {}),
    },
  });
}
