// What the leads finder's pages and its server code both need. No imports, so the browser can load it.

export const FIND = {
  what: 300,
  where: 100,
  offer: 300,
  counts: [5, 10, 15] as const,
  defaultCount: 10,
  /** Web searches the AI may make in one run. */
  searches: 5,
  /** Runs per person and per brand in an hour. */
  perUserHour: 5,
  perBrandHour: 12,
  /** Candidates added to the CRM in one click. */
  addMax: 50,
  company: 120,
  location: 100,
  why: 400,
  url: 300,
} as const;

/** The tag every lead added by the finder gets, so the team can filter on it, or leave it out of an email audience. */
export const AI_TAG = "ai-found";

export type SiteState = "ok" | "unreadable" | "mismatch";
export const SITE_LABEL: Record<SiteState, string> = {
  ok: "Website checked",
  unreadable: "Could not read their site",
  mismatch: "Name not found on their site",
};

export type Candidate = {
  id: string;
  company: string;
  website: string;
  host: string;
  location: string;
  why: string;
  sourceUrl: string;
  emails: string[];
  phones: string[];
  site: SiteState;
  status: "new" | "added" | "skipped";
};

/** Whether a candidate starts ticked. Only a site that opened and carries the business's name is trusted without a look. */
export const preTicked = (c: Pick<Candidate, "site" | "status">) => c.status === "new" && c.site === "ok";

