import { NextRequest } from "next/server";
import { proxyAdminRequest } from "../_upstream";

export async function GET(req: NextRequest) {
  return proxyAdminRequest(req, "/v1/admin/courses", { includeSearch: true });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyAdminRequest(req, "/v1/admin/courses", { method: "POST", body });
}
