// Types for the Chat Room prototype (docs "4 · Product UX and Project Focus").
// MOCK DATA ONLY — nothing in lib/room talks to the database, an LLM or any API.

export type Lang = "en" | "id";
export type Role = "admin" | "member";

export type FieldKey = "brand" | "website" | "handles" | "who" | "what" | "when" | "where" | "why";
/** How a profile field got its value: typed by staff, found on the website, or explicitly unknown. */
export type FieldSource = "answered" | "website" | "unknown";

export type Profile = {
  brand?: string;
  website?: string;
  handles?: string[];
  noAccounts?: boolean;
  who?: string;
  what?: string;
  when?: string;
  where?: string;
  why?: string;
};

export type Project = {
  id: string;
  name: string;
  website: string;
  /** "draft" = an unfinished intake: it shows on the chat start screen, never in the Project tab. */
  status: "active" | "draft";
  profile: Profile;
  sources: Partial<Record<FieldKey, FieldSource>>;
  locked: boolean;
  profileVersion: number | null;
  score: number | null;
  lastActivity: string;
};

export type TodoGroup = "week1" | "d30" | "d90" | "manual";
/** The list a to do sits in on the board, like a Trello list. A new item starts On progress; Approved and Rejected are the admin's call on a tip. */
export type TodoStatus = "progress" | "approved" | "rejected" | "done";
export type Todo = {
  id: string;
  title: string;
  group: TodoGroup;
  /** The failed audit check this item fixes, the tip, and the service that fixes it. */
  check?: string;
  tip?: string;
  service?: string;
  status: TodoStatus;
  assignee?: string;
};

export type ChronicleKind = "profile" | "audit" | "report" | "todo" | "build" | "decision" | "file" | "settings" | "note";
export type ChronicleEntry = { id: string; kind: ChronicleKind; text: string; when: string };

export type AssetKind = "image" | "audio" | "video" | "document" | "other";
export type Asset = { id: string; title: string; kind: AssetKind; tags: string[]; byBuilder?: boolean; useAsContext?: boolean };

export type KnowledgeItem = {
  id: string;
  title: string;
  scope: "workspace" | "project";
  projectId?: string;
  kind: "rule" | "file" | "note";
  tokens: number;
  pinned: boolean;
  /** Extraction failed: shown as failed with the reason, never silently missing from context. */
  failed?: string;
};

export type UsedChip = { kind: "profile" | "report" | "todo" | "chronicle" | "knowledge" | "assets"; label: string };

export type CardState = "pending" | "done" | "dismissed";
/** Chat text never changes state: every change goes through one of these explicit action cards. */
export type MessageAction =
  | { type: "audit"; state: CardState }
  | { type: "todo"; title: string; state: CardState }
  | { type: "note"; text: string; state: CardState }
  | { type: "build"; options: { todoId: string; title: string }[]; state: CardState }
  | { type: "lock"; state: CardState }
  | { type: "offtopic"; text: string; state: "pending" | "note" | "project" }
  | { type: "open"; projectId: string; name: string };

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  used?: UsedChip[];
  action?: MessageAction;
  pinned?: boolean;
};

export type ReportData = {
  audit: number;
  date: string;
  score: number;
  scorecard: { name: string; self?: boolean; must: number; nice: number; try: number; coverage: number }[];
  insights: { id: string; priority: 1 | 2 | 3; title: string; evidence: string; todoId?: string }[];
};

/** A web or content build: linked to the to do it came from, versioned, published → the to do is done. */
export type Build = {
  id: string;
  todoId: string;
  title: string;
  kind: "web" | "content";
  stage: "draft" | "review" | "published";
  version: number;
};

export type IntakeStep = "brand" | "website" | "handles" | "gaps" | "confirm";
export type IntakeState = {
  step: IntakeStep;
  profile: Profile;
  sources: Partial<Record<FieldKey, FieldSource>>;
  /** Questions asked so far (the guided intake asks at most MAX_QUESTIONS). */
  asked: number;
  /** The 5W field currently being asked (step "gaps"). */
  current?: FieldKey;
  /** True once the website and socials have been read and the profile pre-filled. */
  siteRead: boolean;
  /** Id of the draft project this intake resumes, if any. */
  draftId?: string;
};
