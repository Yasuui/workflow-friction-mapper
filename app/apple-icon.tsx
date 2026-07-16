import { ImageResponse } from "next/og";

export const alt = "Workflow Friction Mapper";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      aria-label="Workflow Friction Mapper"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 42,
        background: "#151515",
      }}
    >
      <svg width="132" height="132" viewBox="0 0 64 64">
        <path d="M12 16h14c9 0 14 6 14 15v3c0 9 5 14 14 14" fill="none" stroke="#f5f4ef" strokeWidth="7" strokeLinecap="round" />
        <circle cx="12" cy="16" r="5" fill="#4d7eff" />
        <circle cx="40" cy="32" r="5" fill="#4d7eff" />
        <circle cx="54" cy="48" r="5" fill="#4d7eff" />
      </svg>
    </div>,
    size,
  );
}
