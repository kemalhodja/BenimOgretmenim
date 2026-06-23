import { NextRequest } from "next/server";
import { proxyAdminRequest } from "../_upstream";

export async function GET(req: NextRequest) {
  return proxyAdminRequest(req, "/v1/admin/audit-events", { includeSearch: true });
}
