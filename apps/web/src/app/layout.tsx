import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuba Golf Club | Operations",
  description: "Yuba Golf Club operations dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
