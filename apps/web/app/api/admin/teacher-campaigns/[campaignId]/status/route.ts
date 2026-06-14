import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, hasAdminProxySession, internalApiBase } from "../../../_upstream";

type Ctx = { params: Promise<{ campaignId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!hasAdminProxySession(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { campaignId } = await ctx.params;
  const body = await req.text();
  const headers = adminProxyHeaders(req);
  if (body) headers.set("content-type", req.headers.get("content-type") ?? "application/json");
  const res = await fetch(
    `${internalApiBase()}/v1/teacher-campaigns/admin/${encodeURIComponent(campaignId)}/status`,
    {
      method: "PATCH",
      headers,
      body: body || undefined,
      cache: "no-store",
    },
  );
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
