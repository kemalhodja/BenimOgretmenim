import { ImageResponse } from "next/og";
import { renderLogoIconPng } from "./lib/renderLogoIconPng";

export const runtime = "nodejs";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  const png = await renderLogoIconPng(512);
  const src = `data:image/png;base64,${png.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4faf9",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          width={512}
          height={512}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
