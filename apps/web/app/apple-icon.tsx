import { ImageResponse } from "next/og";
import { brandMarkDataUri } from "./lib/brandMarkSvg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = brandMarkDataUri("bmo-app-icon-180");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #ecf8f6 0%, #a3d9d0 45%, #2a9d8f 100%)",
        }}
      >
        {/* next/image OG ImageResponse içinde kullanılamaz; data URI vektör tek kare */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={140} height={140} alt="" />
      </div>
    ),
    size,
  );
}
