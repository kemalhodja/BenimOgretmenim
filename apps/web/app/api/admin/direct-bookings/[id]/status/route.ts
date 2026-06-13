import { NextRequest } from "next/server";
import { proxyAdminRequest } from "../../../_upstream";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.text();
  return proxyAdminRequest(req, `/v1/admin/direct-bookings/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body,
  });
}
