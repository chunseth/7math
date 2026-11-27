import type { Viewport } from "next";
import { modeSurfaceColors } from "./components/ModeSurface";
import "./globals.css";

export const metadata = { title: "7Math Arena", description: "A four-operation math mastery arena" };
export const viewport: Viewport = { viewportFit: "cover", themeColor: modeSurfaceColors.menu };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
