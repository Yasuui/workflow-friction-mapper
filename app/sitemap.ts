import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://workflow-friction-mapper.vercel.app/",
      lastModified: new Date("2026-08-31"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
