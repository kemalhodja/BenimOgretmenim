import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, internalApiBase } from "../../../../../_upstream";

type Ctx = { params: Promise<{ courseId: string; applicationId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { courseId, applicationId } = await ctx.params;
  const body = await req.text();
  const h = adminProxyHeaders(req);
  if (body) h.set("content-type", "application/json");
  const url = `${internalApiBase()}/v1/admin/courses/${encodeURIComponent(courseId)}/student-applications/${encodeURIComponent(applicationId)}/status`;
  const res = await fetch(url, { method: "PATCH", headers: h, body: body || undefined, cache: "no-store" });
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
