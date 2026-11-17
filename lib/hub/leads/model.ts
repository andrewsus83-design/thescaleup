// Pure rules for the AI leads finder: what a person may ask for, which businesses the AI's answer may name, and how contact details
// are read out of a business's own web page. No I/O, so it can be tested without a network or a model.
//
// The AI only proposes names and websites. Email addresses and phone numbers are never taken from what the model writes: the app
// opens the business's own site and reads them from the page itself (see run.ts), so a contact that is shown was really published.

import { isIP } from "node:net";
import { checkUrl } from "../wiki/net";
import { htmlToText } from "../wiki/build";
import { EMAIL } from "../crm/model";
import { phoneKey, pickPhone } from "../crm/import";
import { AI_TAG, FIND, SITE_LABEL, preTicked, type Candidate, type SiteState } from "./consts";

export { AI_TAG, FIND, SITE_LABEL, preTicked };
export type { Candidate, SiteState };

export type Brief = { what: string; where: string; offer: string; count: number };

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

/** The search form, checked. `what` is the one thing that has to be there. */
export function parseBrief(get: (key: string) => string): { ok: true; value: Brief } | { ok: false; error: string } {
  const what = clean(get("what"));
  if (what.length < 8) return { ok: false, error: "Say what kind of business you want to find, for example: cafes in Surabaya that sell coffee beans online." };
  if (what.length > FIND.what) return { ok: false, error: `Keep it under ${FIND.what} characters.` };
  const where = clean(get("where"));
  if (where.length > FIND.where) return { ok: false, error: `The place is too long (${FIND.where} characters at most).` };
  const offer = clean(get("offer"));
  if (offer.length > FIND.offer) return { ok: false, error: `The offer is too long (${FIND.offer} characters at most).` };
  const n = Number(get("count"));
  const count = (FIND.counts as readonly number[]).includes(n) ? n : FIND.defaultCount;
  return { ok: true, value: { what, where, offer, count } };
}

/** What the AI is told, and what a person reads back on the results page. */
export function briefText(b: Brief): string {
  return [`Looking for: ${b.what}`, b.where && `Where: ${b.where}`, b.offer && `What we offer them: ${b.offer}`, `Return at most ${b.count} businesses.`].filter(Boolean).join("\n");
}

/** Reads a saved brief back. Anything missing becomes empty. */
export function readBrief(raw: unknown): Brief {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const s = (k: string) => (typeof o[k] === "string" ? clean(o[k] as string) : "");
  const n = Number(o.count);
  return { what: s("what"), where: s("where"), offer: s("offer"), count: (FIND.counts as readonly number[]).includes(n) ? n : FIND.defaultCount };
}

// ---------------------------------------------------------------------------------------------- which sites count as a business

/** Social networks and messengers. The AI is told not to search them, and a business whose "website" is one of them is not a business site. */
export const SOCIAL_DOMAINS = ["linkedin.com", "instagram.com", "facebook.com", "fb.com", "tiktok.com", "x.com", "twitter.com", "threads.net", "youtube.com", "pinterest.com", "t.me", "wa.me", "whatsapp.com", "line.me", "snapchat.com", "reddit.com"] as const;

/** Places that list or sell for many businesses, or only link to somewhere else. A business is its own site, not a page on these. */
const NOT_OWN_SITE = [
  ...SOCIAL_DOMAINS,
  "tokopedia.com", "shopee.co.id", "shopee.com", "lazada.co.id", "bukalapak.com", "blibli.com", "olx.co.id", "amazon.com", "ebay.com", "alibaba.com", "etsy.com",
  "google.com", "goo.gl", "maps.app.goo.gl", "g.page", "bing.com", "yelp.com", "tripadvisor.com", "foursquare.com", "wikipedia.org",
  "linktr.ee", "bio.link", "beacons.ai", "lynk.id", "taplink.cc", "wixsite.com", "blogspot.com", "wordpress.com", "medium.com",
  "gojek.com", "grab.com", "traveloka.com", "tiket.com",
];

/** The host without "www.", lower case. */
export const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

const hostIn = (host: string, list: readonly string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));
export const isOwnSite = (host: string) => !hostIn(bareHost(host), NOT_OWN_SITE);

/** A website the AI named, as the business's home page. null when it is not a public web address or not a business's own site. */
export function siteOf(raw: unknown): { url: string; host: string } | null {
  if (typeof raw !== "string") return null;
  const r = checkUrl(raw);
  if (!r.ok) return null;
  const host = bareHost(r.url.hostname);
  if (isIP(host) || !isOwnSite(host)) return null;
  return { url: `${r.url.protocol}//${r.url.hostname}/`, host };
}

/** A page address kept as it is, only when it is a public http(s) address. "" otherwise. */
const pageUrl = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  const r = checkUrl(raw);
  return r.ok ? r.url.toString().slice(0, FIND.url) : "";
};

// ---------------------------------------------------------------------------------------------- the AI's answer

export type Proposed = { company: string; website: string; host: string; location: string; why: string; sourceUrl: string };

/** The JSON between <leads> tags (the last such block wins), or the last [...] in the text. null when there is none. */
function leadsJson(text: string): unknown {
  const tagged = [...text.matchAll(/<leads>([\s\S]*?)<\/leads>/gi)];
  const candidates: string[] = [];
  if (tagged.length) candidates.push(tagged[tagged.length - 1][1]);
  const a = text.lastIndexOf("[");
  const b = text.lastIndexOf("]");
  if (a >= 0 && b > a) candidates.push(text.slice(a, b + 1));
  for (const c of candidates) {
    const s = c.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(s);
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/**
 * What the AI answered, as a list of businesses. Anything that is not a business's own public website is left out and counted;
 * the same business named twice is kept once. Nothing here is trusted: every field is cut to size and every address checked.
 */
export function parseProposed(text: string, max: number): { leads: Proposed[]; notBusiness: number; repeated: number } {
  const raw = leadsJson(text);
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { leads?: unknown }).leads) ? (raw as { leads: unknown[] }).leads : [];
  const leads: Proposed[] = [];
  const seen = new Set<string>();
  let notBusiness = 0;
  let repeated = 0;
  for (const item of list.slice(0, max * 3)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const str = (k: string, n: number) => (typeof o[k] === "string" ? clean(o[k] as string).slice(0, n) : "");
    const company = str("company", FIND.company);
    const site = siteOf(o.website);
    if (!company || !site) {
      notBusiness++;
      continue;
    }
    if (seen.has(site.host)) {
      repeated++;
      continue;
    }
    seen.add(site.host);
    leads.push({ company, website: site.url, host: site.host, location: str("location", FIND.location), why: str("why", FIND.why), sourceUrl: pageUrl(o.source_url) });
    if (leads.length >= max) break;
  }
  return { leads, notBusiness, repeated };
}

// ---------------------------------------------------------------------------------------------- does the site belong to the name

const GENERIC = new Set(["the", "and", "dan", "pt", "cv", "ud", "tbk", "co", "ltd", "inc", "llc", "group", "grup", "indonesia", "official", "store", "shop", "toko", "cafe", "coffee", "kopi", "resto", "restaurant", "restoran", "salon", "studio", "clinic", "klinik", "bakery", "hotel", "online", "jakarta", "surabaya", "bandung", "bali", "medan", "yogyakarta", "semarang"]);

/** The words of a name that say something: no company forms, no "cafe", no cities. */
export const nameWords = (company: string): string[] =>
  company
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w));

/**
 * Whether the page plausibly belongs to the business: one of the name's meaningful words shows in the page title, description or
 * text, or in the site's address. A name made only of generic words cannot be checked, so it passes.
 */
export function nameOnSite(company: string, host: string, pageText: string): boolean {
  const words = nameWords(company);
  if (words.length === 0) return true;
  const hay = pageText.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const h = host.replace(/[^a-z0-9]/g, "");
  return words.some((w) => hay.includes(w) || h.includes(w));
}

// ---------------------------------------------------------------------------------------------- contact details from a page

const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Math.min(parseInt(d, 10), 0x10ffff)))
    .replace(/&commat;|&#64;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ");

const FILE_TLD = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico", "css", "js", "json", "woff", "woff2", "ttf", "otf", "map", "pdf", "mp4", "webm"]);
const PLACEHOLDER_DOMAIN = /(^|\.)(example\.(com|org|net)|domain\.com|email\.com|yourdomain\.com|yoursite\.com|mysite\.com|company\.com|test\.com|sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|godaddy\.com|wordpress\.org|wordpress\.com|w3\.org|schema\.org|gravatar\.com)$/i;
const ROLE_SKIP = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|abuse|webmaster|root|hostmaster|user|name|email|your-?name|you|someone|test)$/i;
const FREE_MAIL = /^(gmail\.com|googlemail\.com|yahoo\.com|yahoo\.co\.id|ymail\.com|hotmail\.com|outlook\.com|live\.com|icloud\.com|proton\.me|protonmail\.com|rocketmail\.com)$/i;

/** One address as a usable lower-case email, or "". */
export function tidyEmail(raw: string): string {
  const e = raw.trim().toLowerCase().replace(/^mailto:/, "").replace(/[.,;:)\]>]+$/, "");
  if (!EMAIL.test(e) || e.length > 254) return "";
  const [local, domain] = e.split("@");
  if (!local || !domain || ROLE_SKIP.test(local) || PLACEHOLDER_DOMAIN.test(domain)) return "";
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (FILE_TLD.has(tld) || !/^[a-z]{2,24}$/.test(tld) || /@\d+x\./.test(e)) return "";
  return e;
}

const sameSite = (domain: string, host: string) => domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`);

/**
 * Email addresses and phone numbers the page really shows. mailto: and tel: links, WhatsApp links and visible text are read; the
 * business's own addresses come first. An address on some other company's domain (a web agency's name in the footer) is dropped,
 * unless it is an ordinary mailbox such as Gmail, which small businesses do use.
 */
export function contactsFromHtml(html: string, host: string): { emails: string[]; phones: string[] } {
  const body = html.slice(0, 600_000);
  const h = bareHost(host);
  const mailLinks: string[] = [];
  for (const m of body.matchAll(/mailto:([^"'<>\s?]+)/gi)) {
    let v = decodeEntities(m[1]);
    try {
      v = decodeURIComponent(v);
    } catch {
      /* keep as is */
    }
    for (const part of v.split(/[,;]/)) mailLinks.push(part);
  }
  const visible = decodeEntities(htmlToText(body, 120_000).text);
  const seenText = [...visible.matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi)].map((m) => m[0]);

  const ranked: { email: string; own: boolean; linked: boolean }[] = [];
  const seen = new Set<string>();
  for (const [list, linked] of [[mailLinks, true], [seenText, false]] as const) {
    for (const raw of list) {
      const email = tidyEmail(raw);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const domain = email.split("@")[1];
      ranked.push({ email, own: sameSite(domain, h), linked });
    }
  }
  const keep = ranked.filter((r) => r.own || FREE_MAIL.test(r.email.split("@")[1]));
  keep.sort((a, b) => Number(b.own) - Number(a.own) || Number(b.linked) - Number(a.linked));
  const emails = keep.slice(0, 3).map((r) => r.email);

  const phones: string[] = [];
  const seenPhone = new Set<string>();
  const addPhone = (raw: string, intl: boolean) => {
    let p = pickPhone(raw);
    if (!p) return;
    if (intl && !p.startsWith("+") && !p.startsWith("0")) p = `+${p}`;
    const digits = p.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return;
    const k = phoneKey(p);
    if (!k || seenPhone.has(k) || /^(\d)\1+$/.test(digits)) return;
    seenPhone.add(k);
    phones.push(p);
  };
  for (const m of body.matchAll(/tel:([+\d\s().%-]{6,30})/gi)) addPhone(decodeEntities(m[1]).replace(/%20/g, " "), false);
  for (const m of body.matchAll(/(?:wa\.me\/|whatsapp\.com\/send\/?\?(?:[^"'\s>]*&)?phone=)\+?(\d{8,15})/gi)) addPhone(m[1], true);
  for (const m of visible.matchAll(/(?<![\d.])(?:\+62|62|0)[\s.-]?8\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}(?![\d])/g)) addPhone(m[0], false);
  for (const m of visible.matchAll(/(?<![\d.])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}(?![\d])/g)) addPhone(m[0], false);
  return { emails, phones: phones.slice(0, 3) };
}

const CONTACT_PATH = /(^|[/_-])(contact|contact-us|contactus|kontak|kontak-kami|hubungi|hubungi-kami|reach-us|get-in-touch)([/_.-]|$)/i;

/** The business's own contact page, if the home page links to one. */
export function contactPage(base: string, hrefs: readonly string[]): string | null {
  let from: URL;
  try {
    from = new URL(base);
  } catch {
    return null;
  }
  for (const h of hrefs) {
    let u: URL;
    try {
      u = new URL(h, from);
    } catch {
      continue;
    }
    if ((u.protocol !== "https:" && u.protocol !== "http:") || bareHost(u.hostname) !== bareHost(from.hostname)) continue;
    if (u.pathname.length > 80 || /\.(?:pdf|jpe?g|png|gif|webp|svg|zip)$/i.test(u.pathname)) continue;
    if (CONTACT_PATH.test(u.pathname)) {
      u.hash = "";
      u.search = "";
      if (u.pathname !== "/" && u.toString() !== from.toString()) return u.toString();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------- a candidate

/** The note kept on the lead: why it was proposed and where it came from. Plain text, under the CRM's note limit. */
export function leadNote(c: Pick<Candidate, "why" | "website" | "sourceUrl" | "site">, what: string): string {
  const lines = [
    "Found by the AI finder from the public web. They have not asked to hear from you yet.",
    c.why && `Why it fits: ${c.why}`,
    `Website: ${c.website}`,
    c.sourceUrl && `Found on: ${c.sourceUrl}`,
    c.site !== "ok" && `Check: ${SITE_LABEL[c.site].toLowerCase()}.`,
    `Search: ${what}`,
  ].filter(Boolean);
  return lines.join("\n").slice(0, 1900);
}
