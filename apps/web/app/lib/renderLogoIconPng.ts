import sharp from "sharp";
import { buildBrandMarkSvgXml } from "./brandMarkSvg";

/** `manifest.ts` background_color ile uyumlu */
const PAD = { r: 244, g: 250, b: 249, alpha: 1 as const };

/**
 * Kare PNG — PWA / favicon / Apple touch için ölçeklenmiş ikon.
 */
export async function renderLogoIconPng(size: number): Promise<Buffer> {
  const svg = Buffer.from(buildBrandMarkSvgXml("bmo-icon-bg", 512));
  return sharp(svg)
    .resize(size, size, {
      fit: "contain",
      position: "center",
      background: PAD,
    })
    .png()
    .toBuffer();
}
