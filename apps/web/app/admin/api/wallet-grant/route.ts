import { NextResponse } from "next/server";
import { getServerApiBaseUrl } from "../../../lib/api";

export async function POST(req: Request) {
  const upstream = getServerApiBaseUrl();
  const auth = req.headers.get("authorization") ?? "";
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");

  const body = await req.text();
  const r = await fetch(`${upstream}/v1/wallet/admin/grant`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}

