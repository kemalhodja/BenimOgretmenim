import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Header + PWA tek kaynak görsel: `public/logo-marketing.png` */
const LOGO_PATH = path.join(process.cwd(), "public", "logo-marketing.png");

/** `manifest.ts` background_color ile uyumlu */
const PAD = { r: 244, g: 250, b: 249, alpha: 1 as const };

/**
 * Kare PNG — PWA / favicon / Apple touch için ölçeklenmiş ikon.
 */
export async function renderLogoIconPng(size: number): Promise<Buffer> {
  const input = await readFile(LOGO_PATH);
  return sharp(input)
    .resize(size, size, {
      fit: "contain",
      position: "center",
      background: PAD,
    })
    .png()
    .toBuffer();
}
