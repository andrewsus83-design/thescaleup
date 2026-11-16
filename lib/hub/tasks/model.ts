// Shared task types and labels. No I/O and no imports, so server code, client components and tests can all use it.

export const PRIORITIES = ["urgent", "high", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
export const isPriority = (v: unknown): v is Priority => typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);

/** What a status does. The workflow maps each status key to one stage; behaviour and visibility follow the stage. */
export const STAGES = ["proposed", "active", "review", "closed", "rejected"] as const;
export type Stage = (typeof STAGES)[number];
export const isStage = (v: unknown): v is Stage => typeof v === "string" && (STAGES as readonly string[]).includes(v);

export type WorkflowStatus = { key: string; label: string; stage: Stage };
export type Workflow = { statuses: WorkflowStatus[]; approvalRequired: boolean };

export const TASK_SOURCES = ["manual", "agent", "audit", "automation", "import", "ai"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];
export const SOURCE_LABEL: Record<TaskSource, string> = {
  manual: "Manual",
  agent: "Agent",
  audit: "Audit",
  automation: "Automation",
  import: "Imported",
  ai: "AI draft",
};

export type Task = {
  id: string;
  brand_id: string;
  title: string;
  description: string | null;
  status: string;
  stage: Stage;
  source: TaskSource;
  priority: Priority;
  assignee_id: string | null;
  start_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  tags: string[];
  completed_at: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export const TASK_COLUMNS =
  "id, brand_id, title, description, status, stage, source, priority, assignee_id, start_date, due_date, tags, completed_at, created_by, approved_by, approved_at, created_at, updated_at";

export type TaskComment = { id: string; task_id: string; author_id: string | null; author_label: string | null; body: string; created_at: string };

export type Member = { userId: string; email: string; role: "founder" | "staff" | "ops" | "viewer" };

/** "dewi.p@brand.com" -> "dewi.p": short enough for a chip, and the same everywhere. */
export const shortName = (email: string) => email.split("@")[0] || email;
export const initials = (email: string) => {
  const parts = shortName(email).split(/[._\-+\s]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return (a + b).toUpperCase();
};
