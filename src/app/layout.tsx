import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plague Doctor — Canadian Wastewater Respiratory Virus Explorer",
  description:
    "Educational public-health surveillance and event-planning app. Data: PHAC National Wastewater Monitoring.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
