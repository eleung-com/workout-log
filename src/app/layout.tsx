import type { Metadata, Viewport } from "next";
import "@fontsource-variable/urbanist";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { BASE } from "@/lib/base";
import RegisterSW from "@/components/RegisterSW";

// Fonts are bundled with the app so it looks right offline in the gym.
export const metadata: Metadata = {
  title: "Lift Log",
  description: "Log a workout in one line.",
  manifest: `${BASE}/manifest.webmanifest`,
  icons: { icon: `${BASE}/icons/icon-192.png`, apple: `${BASE}/icons/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: "Lift Log", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F7F9F6" }, { media: "(prefers-color-scheme: dark)", color: "#121816" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ ["--topo" as string]: `url(${BASE}/topo.svg)` }}>
      <body>{children}<RegisterSW /></body>
    </html>
  );
}
