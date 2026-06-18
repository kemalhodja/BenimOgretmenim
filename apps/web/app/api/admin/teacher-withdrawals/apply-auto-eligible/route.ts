import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, hasAdminProxySession, internalApiBase } from "../../_upstream";

export async function POST(req: NextRequest) {
  if (!hasAdminProxySession(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const h = adminProxyHeaders(req);
  const res = await fetch(`${internalApiBase()}/v1/admin/teacher-withdrawals/apply-auto-eligible`, {
    method: "POST",
    headers: h,
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8" },
  });
}
