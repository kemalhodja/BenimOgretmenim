import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, internalApiBase } from "../_upstream";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = `${internalApiBase()}/v1/subscriptions/admin/pending-bank-transfers`;
  const res = await fetch(url, {
    method: "GET",
    headers: adminProxyHeaders(req),
    cache: "no-store",
  });
  const text = await res.text();
  const rid = res.headers.get("x-request-id");
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/json; charset=utf-8",
      ...(rid ? { "x-request-id": rid } : {}),
    },
  });
}
