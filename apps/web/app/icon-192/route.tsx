import { NextResponse } from "next/server";
import { renderLogoIconPng } from "../lib/renderLogoIconPng";

export const runtime = "nodejs";

export async function GET() {
  try {
    const buf = await renderLogoIconPng(192);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    console.error("[icon-192]", e);
    return new NextResponse("Icon unavailable", { status: 500 });
  }
}
