import "server-only";
import { fetchText } from "../web";
import { SOCIALS, buildDigest, htmlToText, pickLinks, type ReadPart, type Sources } from "./build";
import type { ReadNote } from "./builds";

// Reading a brand's sources (website, social pages) into one block of text. Shared by the Wiki builder and the Brand profile, so both
// read the same way: only public pages, through the guarded reader in lib/hub/web.ts.

const pathOf = (u: string) => {
  try {
    return new URL(u).pathname.replace(/\/$/, "") || "/";
  } catch {
    return "/";
  }
};

/** Reads one address into a part for the digest and a note for the person. `thin` keeps only the title and description (social sites show little else). */
async function readOne(label: string, url: string, thin: boolean): Promise<{ part: ReadPart | null; note: ReadNote; links: string[] }> {
  const r = await fetchText(url);
  if (!r.ok) return { part: null, note: { label, url, ok: false, chars: 0, note: r.error }, links: [] };
  const t = htmlToText(r.body, thin ? 1500 : undefined);
  const text = [t.title && `Title: ${t.title}`, t.description && `Description: ${t.description}`, t.text].filter(Boolean).join("\n");
  if (text.length < 80) return { part: null, note: { label, url, ok: false, chars: text.length, note: "It loaded but has almost no text (the page may build itself in the browser, or hide behind a login)." }, links: t.links };
  return { part: { label, url: r.finalUrl, text }, note: { label, url: r.finalUrl, ok: true, chars: text.length, note: "" }, links: t.links };
}

/** Opens the website (home page plus a few useful pages) and each social page, and joins what was read with the person's notes. */
export async function readSources(src: Sources): Promise<{ read: ReadNote[]; digest: string }> {
  const read: ReadNote[] = [];
  const parts: ReadPart[] = [];
  const jobs: Promise<void>[] = [];
  if (src.website) {
    const site = src.website;
    jobs.push(
      (async () => {
        const home = await readOne("Website", site, false);
        read.push(home.note);
        if (home.part) parts.push(home.part);
        const more = pickLinks(home.part?.url ?? site, home.links);
        const pages = await Promise.all(more.map((u) => readOne(`Website ${pathOf(u)}`, u, false)));
        for (const p of pages) {
          read.push(p.note);
          if (p.part) parts.push(p.part);
        }
      })(),
    );
  }
  for (const s of src.social) {
    const label = SOCIALS.find((x) => x.id === s.id)!.label;
    jobs.push(
      readOne(label, s.url, true).then((r) => {
        read.push(r.note);
        if (r.part) parts.push(r.part);
      }),
    );
  }
  await Promise.all(jobs);
  const order = (l: string) => (l === "Website" ? 0 : l.startsWith("Website") ? 1 : 2);
  parts.sort((a, b) => order(a.label) - order(b.label));
  read.sort((a, b) => order(a.label) - order(b.label));
  return { read, digest: buildDigest(parts, src.notes) };
}
