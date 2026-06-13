import { NextRequest } from "next/server";
import { proxyAdminRequest } from "../../../_upstream";

type Ctx = { params: Promise<{ withdrawalId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { withdrawalId } = await ctx.params;
  const body = await req.text();
  return proxyAdminRequest(req, `/v1/admin/teacher-withdrawals/${encodeURIComponent(withdrawalId)}/status`, {
    method: "PATCH",
    body,
  });
}
