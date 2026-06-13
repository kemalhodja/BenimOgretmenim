import { NextRequest } from "next/server";
import { proxyAdminRequest } from "../../_upstream";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return proxyAdminRequest(req, `/v1/admin/payment-reconciliation/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: await req.text(),
  });
}
