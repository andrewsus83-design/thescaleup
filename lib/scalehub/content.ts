// Shared, framework-agnostic content model for ScaleHub. Safe to import from
// both server and client components (no server-only APIs here).

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "img"; url: string; caption?: string };

export type ArticleSource = "scaleup" | "client";

/** Unified article shape — editorial (ScaleUp) and client-authored merged. */
export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO
  readMinutes: number;
  content: Block[];
  source: ArticleSource;
  authorName: string;
  coverUrl?: string | null;
  featured?: boolean;
};

/** Input for admin create/edit (kept here so the "use server" action file can
 *  reference the type — action modules may only export async functions). */
export type ArticleInput = {
  title: string;
  slug?: string;
  excerpt: string;
  category: string;
  authorType: ArticleSource;
  memberId?: string | null;
  authorName?: string;
  coverUrl?: string;
  contentRaw: string;
  status: "draft" | "published";
  featured: boolean;
};

export function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Lightweight markdown-ish → Block[] ( "## " = heading, "- " = bullet ). */
export function parseContentToBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  const paras = (raw ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const para of paras) {
    const lines = para
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      blocks.push({ type: "ul", items: lines.map((l) => l.replace(/^[-*]\s+/, "")) });
      continue;
    }
    let buf: string[] = [];
    const flush = () => {
      if (buf.length) {
        blocks.push({ type: "p", text: buf.join(" ") });
        buf = [];
      }
    };
    for (const l of lines) {
      const img = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (img) {
        flush();
        blocks.push({
          type: "img",
          url: img[2],
          ...(img[1] ? { caption: img[1] } : {}),
        });
      } else if (/^#{1,3}\s+/.test(l)) {
        flush();
        blocks.push({ type: "h2", text: l.replace(/^#{1,3}\s+/, "") });
      } else {
        buf.push(l);
      }
    }
    flush();
  }
  return blocks;
}

/** Block[] → editable raw text (inverse of parseContentToBlocks). */
export function blocksToRaw(blocks: Block[]): string {
  return (blocks ?? [])
    .map((b) => {
      if (b.type === "h2") return `## ${b.text}`;
      if (b.type === "ul") return b.items.map((i) => `- ${i}`).join("\n");
      if (b.type === "img") return `![${b.caption ?? ""}](${b.url})`;
      return b.text;
    })
    .join("\n\n");
}

export function estimateReadMinutes(blocks: Block[]): number {
  const words = (blocks ?? []).reduce((n, b) => {
    if (b.type === "ul") return n + b.items.join(" ").split(/\s+/).filter(Boolean).length;
    if (b.type === "img") return n;
    return n + b.text.split(/\s+/).filter(Boolean).length;
  }, 0);
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
