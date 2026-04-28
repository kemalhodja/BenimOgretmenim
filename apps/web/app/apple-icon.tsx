import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(280px 280px at 18% 12%, #60a5fa 0%, rgba(96,165,250,0) 55%), linear-gradient(135deg, #1d4ed8 0%, #0b2a7a 100%)",
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 34,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)",
            boxShadow:
              "0 18px 38px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* simplified cap+book for small size */}
          <div
            style={{
              position: "absolute",
              top: 26,
              width: 78,
              height: 20,
              background: "#0b2a7a",
              borderRadius: 10,
              transform: "skewX(-18deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 42,
              width: 50,
              height: 10,
              background: "#1d4ed8",
              borderRadius: 10,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 48,
              left: 86,
              width: 6,
              height: 34,
              background: "#f59e0b",
              borderRadius: 6,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 76,
              left: 82,
              width: 14,
              height: 14,
              background: "#fbbf24",
              borderRadius: 14,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 28,
              width: 84,
              height: 52,
              borderRadius: 16,
              background: "linear-gradient(180deg, #1d4ed8 0%, #163aa8 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 28,
              width: 6,
              height: 52,
              borderRadius: 6,
              background: "rgba(255,255,255,0.65)",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}

