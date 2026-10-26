// Mock data for the Chat Room prototype. Fictional brands; nothing here is read from or written to a database.

import type { Asset, ChronicleEntry, KnowledgeItem, Message, Project, ReportData, Todo } from "./types";

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "kopi-senja",
    name: "Kopi Senja",
    website: "kopisenja.id",
    status: "active",
    locked: true,
    profileVersion: 2,
    score: 68,
    lastActivity: "2 hours ago",
    profile: {
      brand: "Kopi Senja",
      website: "kopisenja.id",
      handles: ["@kopisenja.id", "@kopisenja"],
      who: "Office workers and students in Jakarta who want a slow, good cup in the afternoon",
      what: "Specialty coffee, whole beans and weekend brewing workshops",
      when: "Afternoons and weekends; busiest around payday",
      where: "Two cafés in South Jakarta, plus nationwide bean delivery",
      why: "Single-origin beans roasted weekly and a calm room to work in",
    },
    sources: { brand: "answered", website: "answered", handles: "answered", who: "website", what: "website", when: "answered", where: "answered", why: "answered" },
  },
  {
    id: "batik-laras",
    name: "Batik Laras",
    website: "batiklaras.co.id",
    status: "active",
    locked: true,
    profileVersion: 1,
    score: 54,
    lastActivity: "Yesterday",
    profile: {
      brand: "Batik Laras",
      website: "batiklaras.co.id",
      handles: ["@batiklaras"],
      who: "Women 28–45 buying work and ceremony wear",
      what: "Hand-stamped batik dresses and fabric by the metre",
      when: "Before Lebaran and wedding season",
      where: "Solo workshop, shipping across Indonesia",
      why: "Natural dyes and a named artisan for every piece",
    },
    sources: { brand: "answered", website: "answered", handles: "answered", who: "answered", what: "answered", when: "answered", where: "answered", why: "answered" },
  },
  {
    id: "klinik-prima",
    name: "Klinik Prima",
    website: "klinikprima.id",
    status: "draft",
    locked: false,
    profileVersion: null,
    score: null,
    lastActivity: "3 days ago",
    // saved after the site read: "what" was found on the website, "who" was answered by staff
    profile: { brand: "Klinik Prima", website: "klinikprima.id", handles: ["@klinikprima"], who: "Families in South Jakarta", what: "Family clinic: check-ups, vaccinations and an in-house pharmacy" },
    sources: { brand: "answered", website: "answered", handles: "answered", who: "answered", what: "website" },
  },
];

export const INITIAL_TODOS: Record<string, Todo[]> = {
  "kopi-senja": [
    { id: "t1", title: "Add a FAQ page (hours, delivery, allergens)", group: "week1", check: "FAQ page exists", tip: "10–12 real customer questions, one short answer each, with FAQPage schema.", service: "Web builder · FAQ page", status: "progress" },
    { id: "t2", title: "Add LocalBusiness schema to the homepage", group: "week1", check: "LocalBusiness schema on the homepage", tip: "Name, address, opening hours, phone and geo coordinates.", service: "Web builder · schema", status: "progress" },
    { id: "t3", title: "Allow search crawlers in robots.txt", group: "week1", check: "robots.txt allows search crawlers", tip: "Allow OAI-SearchBot and PerplexityBot so AI answers can cite the site.", service: "Technical fix", status: "done" },
    { id: "t4", title: "Link booking from the Instagram bio", group: "week1", check: "Bio links to booking", tip: "One link, tagged so bookings can be traced to Instagram.", service: "Content builder · profile copy", status: "progress" },
    { id: "t5", title: "Rewrite the About page around the 5W", group: "d30", check: "About page answers who, what and where", tip: "Lead with who it is for and what it does.", service: "Web builder · About", status: "approved" },
    { id: "t6", title: "Publish four how-to posts from the topic bank", group: "d30", check: "Fresh content in the last 30 days", tip: "One post a week, each answering a question customers ask.", service: "Content builder · blog", status: "progress" },
    { id: "t7", title: "Show price and availability on product pages", group: "d30", check: "Product pages show a price", tip: "Price in rupiah and an in-stock flag.", service: "Web builder · landing page", status: "approved" },
    { id: "t8", title: "Collect 20 Google reviews", group: "d90", check: "Review volume vs competitors", tip: "A QR code at the counter and one ask per order.", service: "Manual", status: "rejected" },
    { id: "t9", title: "Call the supplier about the new roast", group: "manual", status: "done" },
  ],
  "batik-laras": [
    { id: "b1", title: "Add Product schema to the 12 best sellers", group: "week1", check: "Product schema on product pages", tip: "Name, price, availability, image.", service: "Web builder · schema", status: "progress" },
    { id: "b2", title: "Write the About page with the artisan stories", group: "d30", check: "About page answers who and why", tip: "One short profile per artisan.", service: "Web builder · About", status: "approved" },
  ],
};

export const INITIAL_CHRONICLE: Record<string, ChronicleEntry[]> = {
  "kopi-senja": [
    { id: "c1", kind: "audit", text: "Audit #3 finished — score 68, 5 insights", when: "2 days ago" },
    { id: "c2", kind: "decision", text: "Positioning: “Specialty coffee for slow afternoons”", when: "Yesterday" },
    { id: "c3", kind: "todo", text: "To do done: Fix the homepage title tag", when: "Yesterday" },
    { id: "c4", kind: "profile", text: "Profile v2 locked (positioning line approved by Dewi)", when: "3 days ago" },
    { id: "c5", kind: "report", text: "Report #2 approved and shared with the client", when: "3 weeks ago" },
    { id: "c6", kind: "file", text: "File added: Brand guide v3.pdf", when: "5 days ago" },
  ],
  "batik-laras": [
    { id: "c7", kind: "profile", text: "Profile v1 locked", when: "1 week ago" },
    { id: "c8", kind: "audit", text: "Audit #1 finished — score 54", when: "6 days ago" },
  ],
};

export const INITIAL_ASSETS: Record<string, Asset[]> = {
  "kopi-senja": [
    { id: "a1", title: "Logo (dark).svg", kind: "image", tags: ["logo", "brand"] },
    { id: "a2", title: "Latte on the bar.jpg", kind: "image", tags: ["product", "menu"] },
    { id: "a3", title: "Storefront at dusk.jpg", kind: "image", tags: ["place"] },
    { id: "a4", title: "Radio jingle 30s.mp3", kind: "audio", tags: ["jingle"] },
    { id: "a5", title: "Founder intro 60s.mp4", kind: "video", tags: ["founder", "intro"] },
    { id: "a6", title: "Brand guide v3.pdf", kind: "document", tags: ["brand"], useAsContext: true },
    { id: "a7", title: "Price list Oct 2026.pdf", kind: "document", tags: ["pricing"], useAsContext: true },
    { id: "a8", title: "FAQ page draft v1.html", kind: "document", tags: ["faq", "draft"], byBuilder: true },
  ],
  "batik-laras": [{ id: "a9", title: "Lookbook 2026.pdf", kind: "document", tags: ["lookbook"] }],
};

export const INITIAL_KNOWLEDGE: KnowledgeItem[] = [
  { id: "k1", title: "Prices are written in rupiah, no decimals", scope: "workspace", kind: "rule", tokens: 120, pinned: true },
  { id: "k2", title: "Tone of voice: warm and direct, Bahasa first", scope: "workspace", kind: "rule", tokens: 180, pinned: true },
  { id: "k3", title: "Claims policy: nothing we cannot verify", scope: "workspace", kind: "rule", tokens: 150, pinned: true },
  { id: "k4", title: "How we name competitors in reports", scope: "workspace", kind: "rule", tokens: 90, pinned: false },
  { id: "k5", title: "Brand guide v3 (summary)", scope: "project", projectId: "kopi-senja", kind: "file", tokens: 1900, pinned: true },
  { id: "k6", title: "Price list Oct 2026 (summary)", scope: "project", projectId: "kopi-senja", kind: "file", tokens: 700, pinned: true },
  { id: "k7", title: "Founder interview notes", scope: "project", projectId: "kopi-senja", kind: "note", tokens: 1400, pinned: true },
  { id: "k8", title: "Menu photo brief", scope: "project", projectId: "kopi-senja", kind: "file", tokens: 400, pinned: false },
  { id: "k9", title: "Supplier contract.pdf", scope: "project", projectId: "kopi-senja", kind: "file", tokens: 0, pinned: false, failed: "Scanned pages — no text could be extracted" },
];

/** The audit behind the Report tab and the grounded chat answers (Kopi Senja only; other projects have none yet). */
export const REPORTS: Record<string, ReportData> = {
  "kopi-senja": {
    audit: 3,
    date: "12 Oct 2026",
    score: 68,
    scorecard: [
      { name: "Kopi Senja", self: true, must: 72, nice: 58, try: 40, coverage: 0.86 },
      { name: "Kopi Rimba", must: 81, nice: 66, try: 52, coverage: 0.92 },
      { name: "Kopi Lab Selatan", must: 64, nice: 49, try: 35, coverage: 0.78 },
    ],
    insights: [
      { id: "i1", priority: 1, title: "No FAQ page — AI answers cannot quote you", evidence: "Crawled 14 URLs: none matched /faq or carried FAQPage schema.", todoId: "t1" },
      { id: "i2", priority: 1, title: "robots.txt blocks a search crawler", evidence: "Line 6 disallows OAI-SearchBot for the whole site.", todoId: "t3" },
      { id: "i3", priority: 2, title: "No LocalBusiness schema on the homepage", evidence: "JSON-LD found: WebSite only.", todoId: "t2" },
      { id: "i4", priority: 2, title: "Product pages show no price", evidence: "9 of 11 product pages have no price element.", todoId: "t7" },
      { id: "i5", priority: 3, title: "Instagram bio does not link to booking", evidence: "The bio link points to the homepage.", todoId: "t4" },
    ],
  },
  "batik-laras": {
    audit: 1,
    date: "9 Oct 2026",
    score: 54,
    scorecard: [
      { name: "Batik Laras", self: true, must: 61, nice: 47, try: 30, coverage: 0.74 },
      { name: "Batik Kencana", must: 78, nice: 63, try: 48, coverage: 0.9 },
    ],
    insights: [
      { id: "j1", priority: 1, title: "Product pages have no Product schema", evidence: "0 of 12 product pages include structured data.", todoId: "b1" },
      { id: "j2", priority: 2, title: "About page does not say who the artisans are", evidence: "The page has 80 words and no names.", todoId: "b2" },
    ],
  },
};

/** What a freshly finished audit looks like (stand-in for the real pipeline's output). */
export function nextReport(projectName: string, prev?: ReportData): ReportData {
  if (prev) {
    return {
      ...prev,
      audit: prev.audit + 1,
      date: "Just now",
      score: Math.min(100, prev.score + 3),
      scorecard: prev.scorecard.map((s) => (s.self ? { ...s, must: Math.min(100, s.must + 3), nice: Math.min(100, s.nice + 2) } : s)),
    };
  }
  return {
    audit: 1,
    date: "Just now",
    score: 52,
    scorecard: [
      { name: projectName, self: true, must: 52, nice: 40, try: 25, coverage: 0.7 },
      { name: "Competitor A", must: 74, nice: 60, try: 44, coverage: 0.9 },
      { name: "Competitor B", must: 61, nice: 48, try: 33, coverage: 0.8 },
    ],
    insights: [
      { id: "n1", priority: 1, title: "No FAQ page — AI answers cannot quote you", evidence: "Crawled 9 URLs: none matched /faq or carried FAQPage schema." },
      { id: "n2", priority: 2, title: "No LocalBusiness schema on the homepage", evidence: "No JSON-LD found on the homepage." },
      { id: "n3", priority: 3, title: "Instagram bio does not link to the website", evidence: "The bio link field is empty." },
    ],
  };
}

/** The first audit turns its insights into a Week 1 plan: each item names the failed check, the tip and the service. */
export function todosFromReport(report: ReportData, mkId: () => string): Todo[] {
  return report.insights.map((i) => ({
    id: mkId(),
    title: i.title.split(" — ")[0],
    group: "week1" as const,
    check: i.title,
    tip: i.evidence,
    service: i.priority === 3 ? "Content builder · profile copy" : "Web builder · page or schema",
    status: "progress" as const,
  }));
}

export const SEED_THREADS: Record<string, Message[]> = {
  "kopi-senja": [
    { id: "m1", role: "system", text: "Thread started · Kopi Senja · Profile v2 · Audit #3" },
    { id: "m2", role: "user", text: "What are the top gaps in our latest report?" },
    {
      id: "m3",
      role: "assistant",
      text: "From audit #3 (score 68), the three biggest gaps are:\n1. No FAQ page, so AI answers cannot quote the site.\n2. robots.txt blocks OAI-SearchBot.\n3. No LocalBusiness schema on the homepage.\nI only looked at the report and the profile; I have not checked the live site today.",
      used: [
        { kind: "report", label: "Report · audit #3" },
        { kind: "profile", label: "Profile v2" },
      ],
    },
  ],
  "batik-laras": [{ id: "m4", role: "system", text: "Thread started · Batik Laras · Profile v1 · Audit #1" }],
};

export const RECENT_THREADS: Record<string, string[]> = {
  "kopi-senja": ["Top gaps in the report"],
  "batik-laras": ["Product schema plan"],
};
