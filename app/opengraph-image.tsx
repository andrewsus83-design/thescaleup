import { ImageResponse } from "next/og";

export const alt = "ScaleUp — Dewan Direksi AI untuk Scale-Up Bisnis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#0A1020",
          backgroundImage:
            "radial-gradient(60% 60% at 80% 0%, rgba(255,87,51,0.28), transparent 70%), radial-gradient(50% 50% at 0% 100%, rgba(224,62,26,0.22), transparent 70%)",
          color: "#F8FAFC",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg,#E03E1A,#FF5733,#FF9A3D)",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            ↗
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            ScaleUp
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 940,
            }}
          >
            <span>Temukan kebocoran omzet Anda, lalu&nbsp;</span>
            <span style={{ color: "#FF7A5C" }}>scale up.</span>
          </div>
          <div style={{ fontSize: 30, color: "#94A3B8", maxWidth: 900 }}>
            Dewan direksi AI (CMO · CBO · CTO) yang mengaudit bisnis Anda dan
            menyerahkan roadmap scale-up yang siap dieksekusi.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#64748B" }}>
          thescaleup.xyz
        </div>
      </div>
    ),
    { ...size },
  );
}
