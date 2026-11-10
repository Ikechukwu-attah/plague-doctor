import { ImageResponse } from "next/og";
import { SOCIAL_IMAGE_ALT, SOCIAL_SITE_NAME, SOCIAL_TAGLINE } from "@/ui-copy/social";

/*
 * Static social preview (UI-19.30). No data fetch, no dates, no place names: it can never be stale.
 * Palette: ink-900 #0B1020, ink-700 #1C2742, parchment #EADFC8, parchment-dim #B9AE98, lantern #F2B544.
 * Uses ImageResponse's built-in font, so no file or network access happens at build or runtime.
 */
export const alt = SOCIAL_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 96px",
          background: "linear-gradient(135deg, #0B1020 0%, #121A30 60%, #1C2742 100%)",
          color: "#EADFC8",
        }}
      >
        <svg width="260" height="260" viewBox="0 0 34 34" fill="none">
          <g stroke="#F2B544" strokeWidth="1.2" strokeLinejoin="round" fill="none">
            <path d="M6 13c0-5 4-9 9-9s8 4 8 8l9 9-11-2c-1 4-4 7-8 7-4 0-7-4-7-9z" />
            <circle cx="13" cy="12" r="2.4" />
          </g>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -1, color: "#EADFC8" }}>
            {SOCIAL_SITE_NAME}
          </div>
          <div style={{ marginTop: 20, fontSize: 40, color: "#F2B544" }}>{SOCIAL_TAGLINE}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
