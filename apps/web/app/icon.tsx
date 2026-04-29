import { ImageResponse } from "next/og";
import { brandMarkDataUri } from "./lib/brandMarkSvg";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  const src = brandMarkDataUri("bmo-app-icon-512");

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
        {/* next/image OG ImageResponse içinde kullanılamaz; data URI vektör tek kare */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={400} height={400} alt="" />
      </div>
    ),
    size,
  );
}
