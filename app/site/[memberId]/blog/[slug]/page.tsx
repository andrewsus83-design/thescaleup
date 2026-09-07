import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSite } from "@/lib/builders/website/load";
import { postSlug } from "@/lib/builders/website/schema";
import { parseContentToBlocks } from "@/lib/scalehub/content";
import { articleGraph, breadcrumbGraph, siteBase } from "@/lib/builders/website/seo";
import { site } from "@/lib/site";
import { SiteChrome } from "@/components/builders/website/site-chrome";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string; slug: string }> };

type PostItem = { title: string; date?: string; excerpt?: string; body?: string; cover?: string };

async function findPost(memberId: string, slug: string) {
  const site = await loadSite(memberId);
  if (!site || !site.doc) return null;
  // Resolve a post from a "posts" block on ANY page (not only a page named "blog").
  const items = site.doc.pages.flatMap((p) =>
    p.blocks
      .filter((b) => b.type === "posts")
      .flatMap((b) => (Array.isArray(b.props.items) ? (b.props.items as PostItem[]) : [])),
  );
  const post = items.find((it) => postSlug(it.title ?? "") === slug);
  if (!post) return null;
  return { site, post };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId, slug } = await params;
  const r = await findPost(memberId, slug);
  if (!r) return { title: "Artikel" };
  const coverAbs =
    r.post.cover && r.post.cover.startsWith("/")
      ? `${site.url.replace(/\/$/, "")}${r.post.cover}`
      : r.post.cover;
  const url = `${siteBase(memberId)}/blog/${slug}`;
  return {
    title: `${r.post.title} · ${r.site.brand}`,
    description: r.post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: r.site.brand,
      locale: "id_ID",
      title: r.post.title,
      description: r.post.excerpt,
      url,
      ...(coverAbs ? { images: [coverAbs] } : {}),
    },
    twitter: { card: coverAbs ? "summary_large_image" : "summary", title: r.post.title, description: r.post.excerpt },
    robots: { index: true, follow: true },
  };
}

const safe = (u?: string) => {
  const v = String(u ?? "").trim();
  return v.startsWith("/") || /^https?:\/\//i.test(v) ? v : "";
};

export default async function PostPage({ params }: Params) {
  const { memberId, slug } = await params;
  const r = await findPost(memberId, slug);
  if (!r) notFound();
  const { site, post } = r;
  const blocks = parseContentToBlocks(post.body ?? "");
  const cover = safe(post.cover);

  const extraLd = [
    ...articleGraph(memberId, site.doc!.theme.brand, post),
    ...breadcrumbGraph(memberId, [
      { name: "Home", slug: "" },
      { name: "Blog", slug: "blog" },
    ]),
  ];

  return (
    <SiteChrome doc={site.doc!} memberId={memberId} activeSlug="blog" extraLd={extraLd}>
      <article className="mx-auto max-w-3xl px-6 py-14">
        <a href={`/site/${memberId}/blog`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Semua artikel
        </a>
        {post.date && <p className="mt-6 text-sm text-slate-400">{post.date}</p>}
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
          {post.title}
        </h1>
        {post.excerpt && <p className="mt-4 text-lg text-slate-600">{post.excerpt}</p>}
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={post.title} className="mt-8 w-full rounded-2xl object-cover" />
        )}
        <div className="mt-8 space-y-5">
          {blocks.map((b, i) => {
            if (b.type === "h2")
              return <h2 key={i} className="pt-3 font-display text-2xl font-bold text-slate-900">{b.text}</h2>;
            if (b.type === "ul")
              return (
                <ul key={i} className="space-y-2">
                  {b.items.map((it, j) => (
                    <li key={j} className="flex gap-3 text-slate-700">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span className="leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ul>
              );
            if (b.type === "img") {
              const src = safe(b.url);
              return src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={b.caption ?? ""} className="w-full rounded-2xl" />
              ) : null;
            }
            return <p key={i} className="leading-[1.8] text-slate-700">{b.text}</p>;
          })}
        </div>
      </article>
    </SiteChrome>
  );
}
