import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell";
import { socialMetadata } from "@/lib/social-metadata";
import { SOCIAL_DEFAULT_DESCRIPTION, SOCIAL_DEFAULT_TITLE } from "@/ui-copy/social";
import "./globals.css";

/*
 * K7: fonts are committed SIL OFL woff2 files (licences alongside in ./fonts),
 * so there is no third-party request at build or runtime.
 */
const cormorant = localFont({
  src: [
    { path: "./fonts/CormorantGaramond-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/CormorantGaramond-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-cormorant",
  display: "swap",
  // Task 15.7: only Inter (the limitation line, the LCP element) is preloaded; display type swaps in.
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});
const inter = localFont({
  src: [{ path: "./fonts/Inter-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});
const jetbrains = localFont({
  src: [{ path: "./fonts/JetBrainsMono-500.woff2", weight: "500", style: "normal" }],
  variable: "--font-jetbrains",
  display: "swap",
  // Mono is used only for dates and IDs below the fold; do not preload it for the first paint.
  preload: false,
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

// Fallback origin for absolute og:image URLs (a canonical site address, never fetched).
const SITE_ORIGIN = "https://plague-doctor.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  ...socialMetadata({ title: SOCIAL_DEFAULT_TITLE, description: SOCIAL_DEFAULT_DESCRIPTION }),
};

export const viewport: Viewport = {
  themeColor: "#0B1020",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-CA"
      className={`${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
