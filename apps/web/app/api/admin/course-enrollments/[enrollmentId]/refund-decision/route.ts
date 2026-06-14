import { NextRequest, NextResponse } from "next/server";
import { adminProxyHeaders, hasAdminProxySession, internalApiBase } from "../../../_upstream";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  if (!hasAdminProxySession(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { enrollmentId } = await params;
  const res = await fetch(
    `${internalApiBase()}/v1/admin/course-enrollments/${encodeURIComponent(enrollmentId)}/refund-decision`,
    {
      method: "PATCH",
      headers: adminProxyHeaders(req),
      body: await req.text(),
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
