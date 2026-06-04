import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, internalApiBase } from "../../_upstream";

type Ctx = { params: Promise<{ threadId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { threadId } = await ctx.params;
  const body = await req.text();
  const h = adminProxyHeaders(req);
  h.set("content-type", req.headers.get("content-type") ?? "application/json");
  const res = await fetch(`${internalApiBase()}/v1/admin/support-threads/${encodeURIComponent(threadId)}`, {
    method: "PATCH",
    headers: h,
    body,
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
