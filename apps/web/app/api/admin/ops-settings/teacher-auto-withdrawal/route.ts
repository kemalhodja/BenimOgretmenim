import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, hasAdminProxySession, internalApiBase } from "../../_upstream";

export async function GET(req: NextRequest) {
  if (!hasAdminProxySession(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await fetch(`${internalApiBase()}/v1/admin/ops-settings/teacher-auto-withdrawal`, {
    headers: adminProxyHeaders(req),
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8" },
  });
}

export async function PATCH(req: NextRequest) {
  if (!hasAdminProxySession(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.text();
  const h = adminProxyHeaders(req);
  h.set("content-type", "application/json");
  const res = await fetch(`${internalApiBase()}/v1/admin/ops-settings/teacher-auto-withdrawal`, {
    method: "PATCH",
    headers: h,
    body,
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8" },
  });
}
