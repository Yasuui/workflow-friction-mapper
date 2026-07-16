import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workflow Friction Mapper",
  description: "A private, browser-only workflow analysis tool by AI automation developer Yonis Diriye.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
