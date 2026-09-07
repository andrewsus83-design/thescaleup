import { site } from "@/lib/site";
import type { WebsiteDoc, WebBlock } from "./schema";

// Structured-data (JSON-LD) + metadata helpers so every generated site ships
// with the SEO / GEO (AI-Search) / social signals a "good" website has.

export function siteBase(memberId: string): string {
  return `${site.url.replace(/\/$/, "")}/site/${memberId}`;
}

function phone(whatsapp?: string): string | undefined {
  const d = (whatsapp ?? "").replace(/[^0-9]/g, "");
  return d ? `+${d}` : undefined;
}

function abs(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${site.url.replace(/\/$/, "")}${url}`;
  return undefined;
}

/** Find the hero image (absolute) for OG/social + LocalBusiness image. */
export function heroImage(doc: WebsiteDoc): string | undefined {
  for (const p of doc.pages) {
    for (const b of p.blocks) {
      if (b.type === "hero" && typeof b.props.image === "string" && b.props.image) {
        return abs(b.props.image as string);
      }
    }
  }
  return undefined;
}

/** Site-wide graph: LocalBusiness + WebSite. GEO/local-SEO backbone. */
export function siteGraph(doc: WebsiteDoc, memberId: string): object[] {
  const base = siteBase(memberId);
  const img = heroImage(doc);
  const tel = phone(doc.theme.whatsapp);
  const business: Record<string, unknown> = {
    "@type": "LocalBusiness",
    "@id": `${base}#business`,
    name: doc.theme.brand,
    url: base,
    areaServed: "ID",
    ...(img ? { image: img, logo: img } : {}),
    ...(tel ? { telephone: tel } : {}),
  };
  const website = {
    "@type": "WebSite",
    "@id": `${base}#website`,
    name: doc.theme.brand,
    url: base,
    publisher: { "@id": `${base}#business` },
    inLanguage: "id-ID",
  };
  return [business, website];
}

export function faqGraph(blocks: WebBlock[]): object[] {
  const faq = blocks.find((b) => b.type === "faq");
  const items = Array.isArray(faq?.props.items) ? (faq!.props.items as Record<string, string>[]) : [];
  if (!items.length) return [];
  return [
    {
      "@type": "FAQPage",
      mainEntity: items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    },
  ];
}

export function breadcrumbGraph(memberId: string, crumbs: { name: string; slug: string }[]): object[] {
  const base = siteBase(memberId);
  return [
    {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.slug ? `${base}/${c.slug}` : base,
      })),
    },
  ];
}

export function articleGraph(
  memberId: string,
  brand: string,
  post: { title: string; date?: string; excerpt?: string; cover?: string },
): object[] {
  const base = siteBase(memberId);
  return [
    {
      "@type": "BlogPosting",
      headline: post.title,
      ...(post.excerpt ? { description: post.excerpt } : {}),
      ...(abs(post.cover) ? { image: abs(post.cover) } : {}),
      author: { "@type": "Organization", name: brand },
      publisher: { "@type": "Organization", name: brand, "@id": `${base}#business` },
      inLanguage: "id-ID",
    },
  ];
}

/** Render a JSON-LD <script> payload string (escaped for safe inlining). */
export function jsonLdString(graph: object[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
