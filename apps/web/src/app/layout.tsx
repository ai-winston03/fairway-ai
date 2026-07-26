import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuba Golf Club | Operations",
  description: "Yuba Golf Club operations dashboard"
};

// Without an explicit device viewport, mobile Safari can lay this desktop
// workspace out against a ~980px virtual canvas. That bypasses the mobile
// breakpoints and leaves a wide, unusable blank rail beside the content.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
