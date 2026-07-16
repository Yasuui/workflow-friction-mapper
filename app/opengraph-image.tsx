import { ImageResponse } from "next/og";

export const alt = "Workflow Friction Mapper — Find the friction before you automate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function SocialMark() {
  return (
    <svg width="96" height="96" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#151515" />
      <path d="M15 18h12c8 0 12 5 12 13v3c0 8 4 12 12 12" fill="none" stroke="#f5f4ef" strokeWidth="7" strokeLinecap="round" />
      <circle cx="15" cy="18" r="5" fill="#4d7eff" />
      <circle cx="39" cy="32" r="5" fill="#4d7eff" />
      <circle cx="51" cy="46" r="5" fill="#4d7eff" />
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "62px 70px 58px",
        background: "#f5f4ef",
        color: "#151515",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <SocialMark />
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.8px" }}>Workflow Friction Mapper</div>
          <div style={{ fontSize: 18, color: "#686863" }}>Private, browser-local workflow analysis</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ maxWidth: 980, fontSize: 72, lineHeight: 1.02, fontWeight: 700, letterSpacing: "-4px" }}>
          Find the friction before you automate.
        </div>
        <div style={{ maxWidth: 900, fontSize: 24, lineHeight: 1.45, color: "#686863" }}>
          Map one manual workflow, understand the signals, and choose a safer measurable pilot.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18 }}>
        <div style={{ display: "flex", gap: 12, color: "#315c4d" }}>
          <span>No account</span><span>·</span><span>No upload</span><span>·</span><span>No tracking</span>
        </div>
        <div style={{ color: "#2167ff", fontWeight: 700 }}>workflow-friction-mapper.vercel.app</div>
      </div>
    </div>,
    size,
  );
}
