// Pure rules for the Import hub: which sources exist, and how a request for a new one is read. No I/O.

export type SourceInfo = { id: string; name: string; brings: string; href: (slug: string) => string };

/** The importers that exist. A new one is added here and gets its own page under Settings, Import. */
export const SOURCES: readonly SourceInfo[] = [
  { id: "clickup", name: "ClickUp", brings: "Docs to the Wiki; lists to Tasks, CRM leads or the Content plan", href: (slug) => `/hub/b/${slug}/settings/import/clickup` },
];

/** Things people often ask for. Only a shortcut for the request box: none of these exists yet. */
export const SUGGESTIONS = ["Trello", "Asana", "Notion", "Google Sheets or CSV", "Airtable", "Monday", "Jira", "Excel"] as const;

export const REQUEST_LIMITS = { source: 80, note: 500, perHour: 10 } as const;

export const REQUEST_STATUS = ["open", "planned", "done", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];
export const REQUEST_LABEL: Record<RequestStatus, string> = { open: "Asked", planned: "Planned", done: "Done", declined: "Not planned" };
export const isRequestStatus = (v: unknown): v is RequestStatus => typeof v === "string" && (REQUEST_STATUS as readonly string[]).includes(v);

export type Request = { id: string; source: string; note: string; status: RequestStatus; created_at: string };

const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/** A request from the form. Both fields are plain text; the note keeps its line breaks. */
export function parseRequest(get: (k: string) => string): { ok: true; value: { source: string; note: string } } | { ok: false; error: string } {
  const source = oneLine(get("source"));
  if (!source) return { ok: false, error: "Say what you want to import from, for example Trello or a Google Sheet." };
  if (source.length > REQUEST_LIMITS.source) return { ok: false, error: `Keep the name under ${REQUEST_LIMITS.source} characters.` };
  const note = get("note").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (note.length > REQUEST_LIMITS.note) return { ok: false, error: `Keep the note under ${REQUEST_LIMITS.note} characters.` };
  if (/\b(password|passwd|api[ _-]?key|secret|token)\s*[:=]\s*\S{6,}/i.test(`${source}\n${note}`)) return { ok: false, error: "This looks like it contains a password or a key. Take it out: a request is not a safe place for secrets." };
  return { ok: true, value: { source, note } };
}
