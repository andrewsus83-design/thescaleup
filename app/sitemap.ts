import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getAllArticles } from "@/lib/scalehub/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/cara-kerja`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/executive-board`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/scalehub`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/mulai`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
  ];

  let articles: MetadataRoute.Sitemap = [];
  try {
    const all = await getAllArticles();
    articles = all.map((a) => ({
      url: `${base}/scalehub/${a.slug}`,
      lastModified: new Date(a.date),
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {
    // DB unavailable at build — sitemap still lists static pages.
  }

  return [...pages, ...articles];
}
