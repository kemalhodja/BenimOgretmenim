import { NextResponse } from "next/server";
import { getServerApiBaseUrl } from "../../../lib/api";

export async function GET(req: Request) {
  const upstream = getServerApiBaseUrl();
  const auth = req.headers.get("authorization") ?? "";
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  headers.set("accept", "application/json");
  const sec = process.env.ADMIN_API_SECRET?.trim();
  if (sec) headers.set("x-admin-secret", sec);

  const r = await fetch(`${upstream}/v1/subscriptions/admin/pending-bank-transfers`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}

