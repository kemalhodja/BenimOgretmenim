/**
 * logo-marketing.png: Köşe rengini arka plan kabul edip yalnızca kenardan bağlı
 * pikselleri şeffaf yapar (içteki beyaz yazı korunur).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, "../public/logo-marketing.png");
const tmp = path.join(__dirname, "../public/logo-marketing.png.tmp");

async function main() {
  if (!fs.existsSync(input)) {
    console.error("missing", input);
    process.exit(1);
  }

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) throw new Error("RGBA bekleniyordu");

  const buf = new Uint8ClampedArray(data);

  const idx = (x, y) => (y * width + x) * 4;

  const corners = [idx(0, 0), idx(width - 1, 0), idx(0, height - 1), idx(width - 1, height - 1)];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (const i of corners) {
    sumR += buf[i];
    sumG += buf[i + 1];
    sumB += buf[i + 2];
  }
  const bgR = Math.round(sumR / 4);
  const bgG = Math.round(sumG / 4);
  const bgB = Math.round(sumB / 4);

  const tol = 36;
  const similarBg = (r, g, b) =>
    Math.abs(r - bgR) <= tol && Math.abs(g - bgG) <= tol && Math.abs(b - bgB) <= tol;

  const visited = new Uint8Array(width * height);
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pi = y * width + x;
    if (visited[pi]) return;
    const i = idx(x, y);
    if (!similarBg(buf[i], buf[i + 1], buf[i + 2])) return;
    visited[pi] = 1;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    const i = idx(x, y);
    buf[i + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  await sharp(Buffer.from(buf), { raw: { width, height, channels: 4 } }).png().toFile(tmp);
  fs.renameSync(tmp, input);
  console.log("[remove-logo-bg] tamam", { width, height, bg: [bgR, bgG, bgB], tol });
}

main().catch((e) => {
  console.error(e);
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* */
  }
  process.exit(1);
});
