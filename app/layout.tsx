import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://workflow-friction-mapper.vercel.app"),
  title: "Workflow Friction Mapper",
  description: "Map one manual workflow, understand directional automation signals, and choose a safer measurable pilot—all in your browser.",
  applicationName: "Workflow Friction Mapper",
  authors: [{ name: "Yonis Diriye", url: "https://www.linkedin.com/in/yonisdiriye/" }],
  creator: "Yonis Diriye",
  keywords: ["workflow automation", "AI automation", "process improvement", "workflow analysis", "privacy-first"],
  alternates: { canonical: "/" },
  icons: { icon: "/icon.svg", apple: "/apple-icon" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Workflow Friction Mapper",
    description: "Find the friction before you automate with a private, browser-local workflow assessment.",
    siteName: "Workflow Friction Mapper",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Workflow Friction Mapper — Find the friction before you automate" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workflow Friction Mapper",
    description: "Find the friction before you automate with a private, browser-local workflow assessment.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
