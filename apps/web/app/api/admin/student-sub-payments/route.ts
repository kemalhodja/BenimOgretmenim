import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, internalApiBase } from "../_upstream";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const u = new URL(req.url);
  const res = await fetch(`${internalApiBase()}/v1/admin/student-sub-payments${u.search}`, {
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
