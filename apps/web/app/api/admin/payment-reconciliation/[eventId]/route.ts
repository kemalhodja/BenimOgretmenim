import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, internalApiBase } from "../../_upstream";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { eventId } = await params;
  const headers = adminProxyHeaders(req);
  headers.set("content-type", req.headers.get("content-type") ?? "application/json");
  const res = await fetch(`${internalApiBase()}/v1/admin/payment-reconciliation/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers,
    body: await req.text(),
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
