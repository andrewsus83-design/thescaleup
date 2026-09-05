import "server-only";

export type SiteData = {
  ok: boolean;
  url: string;
  title?: string;
  description?: string;
  text?: string;
  error?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetch a URL server-side and return cleaned text + title/description. */
export async function fetchSiteText(rawUrl: string): Promise<SiteData> {
  if (!rawUrl || !rawUrl.trim()) return { ok: false, url: rawUrl, error: "no url" };
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ScaleUpBot/1.0; +https://thescaleup.xyz)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status}` };
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
    const description = (
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      )?.[1] ??
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
      )?.[1] ??
      ""
    ).trim();
    const text = stripHtml(html).slice(0, 6000);
    return { ok: true, url, title, description, text };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      url,
      error: err?.name === "AbortError" ? "timeout" : err?.message ?? "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
