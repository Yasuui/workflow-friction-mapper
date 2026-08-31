import type { Metadata } from "next";
import WorkflowPostHog from "@/components/WorkflowPostHog";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://workflow-friction-mapper.vercel.app"),
  title: "Workflow Friction Mapper",
  description: "Chat with an agent that reads the workflow you share, names friction, and proposes a first move.",
  applicationName: "Workflow Friction Mapper",
  authors: [{ name: "Yonis Diriye", url: "https://www.linkedin.com/in/yonisdiriye/" }],
  creator: "Yonis Diriye",
  keywords: ["workflow automation", "AI agent", "process improvement", "workflow analysis"],
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Workflow Friction Mapper",
    description: "A chat agent that optimizes one workflow from what you share.",
    siteName: "Workflow Friction Mapper",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Workflow Friction Mapper — Find the friction before you automate" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workflow Friction Mapper",
    description: "A chat agent that optimizes one workflow from what you share.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "light", backgroundColor: "#f5f4ef", color: "#151515" }}>
      <body><WorkflowPostHog />{children}</body>
    </html>
  );
}
