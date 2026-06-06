import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, internalApiBase } from "../../../_upstream";

type Ctx = { params: Promise<{ withdrawalId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { withdrawalId } = await ctx.params;
  const body = await req.text();
  const headers = adminProxyHeaders(req);
  if (body) headers.set("content-type", req.headers.get("content-type") ?? "application/json");
  const res = await fetch(
    `${internalApiBase()}/v1/admin/teacher-withdrawals/${encodeURIComponent(withdrawalId)}/status`,
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
