import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
            "radial-gradient(900px 900px at 15% 10%, #60a5fa 0%, rgba(96,165,250,0) 55%), linear-gradient(135deg, #1d4ed8 0%, #0b2a7a 100%)",
          borderRadius: 112,
        }}
      >
        {/* card */}
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 112,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.10) 100%)",
            border: "1px solid rgba(255,255,255,0.22)",
            boxShadow:
              "0 30px 70px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* emblem */}
          <div
            style={{
              width: 260,
              height: 260,
              borderRadius: 92,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)",
              boxShadow: "0 22px 45px rgba(0,0,0,0.18)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* cap */}
            <div
              style={{
                position: "absolute",
                top: 42,
                width: 170,
                height: 50,
                background: "#0b2a7a",
                borderRadius: 18,
                transform: "skewX(-18deg)",
                boxShadow: "0 8px 16px rgba(11,42,122,0.35)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 78,
                width: 110,
                height: 22,
                background: "#1d4ed8",
                borderRadius: 14,
              }}
            />
            {/* tassel */}
            <div
              style={{
                position: "absolute",
                top: 88,
                left: 172,
                width: 10,
                height: 80,
                background: "#f59e0b",
                borderRadius: 8,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 160,
                left: 165,
                width: 26,
                height: 26,
                background: "#fbbf24",
                borderRadius: 26,
                boxShadow: "0 8px 14px rgba(245,158,11,0.35)",
              }}
            />

            {/* book */}
            <div
              style={{
                position: "absolute",
                bottom: 56,
                width: 178,
                height: 112,
                borderRadius: 26,
                background: "linear-gradient(180deg, #1d4ed8 0%, #163aa8 100%)",
                boxShadow: "0 18px 30px rgba(29,78,216,0.30)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 56,
                width: 12,
                height: 112,
                borderRadius: 10,
                background: "rgba(255,255,255,0.65)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 84,
                width: 138,
                height: 6,
                borderRadius: 6,
                background: "rgba(255,255,255,0.70)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 102,
                width: 116,
                height: 6,
                borderRadius: 6,
                background: "rgba(255,255,255,0.55)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  );
}

