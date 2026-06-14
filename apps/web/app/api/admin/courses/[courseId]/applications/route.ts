import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, hasAdminProxySession, internalApiBase } from "../../../_upstream";

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!hasAdminProxySession(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { courseId } = await ctx.params;
  const url = `${internalApiBase()}/v1/admin/courses/${encodeURIComponent(courseId)}/applications`;
  const res = await fetch(url, { method: "GET", headers: adminProxyHeaders(req), cache: "no-store" });
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
