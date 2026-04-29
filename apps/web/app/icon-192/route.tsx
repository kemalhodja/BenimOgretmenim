import { ImageResponse } from "next/og";
import { brandMarkDataUri } from "../lib/brandMarkSvg";

/**
 * Play / Chrome PWA için 192×192 PNG (manifest `sizes: 192x192`).
 */
export async function GET() {
  const src = brandMarkDataUri("bmo-pwa-192");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #eef3fb 0%, #dbe6f6 45%, #b9cdf0 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={148} height={148} alt="" />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
