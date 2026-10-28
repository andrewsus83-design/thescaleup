"use client";

// Shared state for the whole Chat Room: one provider in the layout, so the active project, to dos, chat
// threads and an in-flight audit survive moving between Chat / Project / Builder / Assets / Setting.
// Brands and per-brand API keys are persisted to DB (report_clients / report_client_settings).

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  INITIAL_ASSETS,
  INITIAL_CHRONICLE,
  INITIAL_KNOWLEDGE,
  INITIAL_PROJECTS,
  INITIAL_TODOS,
  REPORTS,
  SEED_THREADS,
  nextReport,
  todosFromReport,
} from "@/lib/room/mock";
import { loadBrands, loadBrandKeys } from "@/lib/room/brand-actions";
import type { OwnKey, ProviderId } from "@/components/room/projects/brand-keys";
import { statusChronicle } from "@/lib/room/todos";
import type {
  Asset,
  Build,
  ChronicleEntry,
  ChronicleKind,
  IntakeState,
  KnowledgeItem,
  Message,
  Project,
  ReportData,
  Role,
  Todo,
  TodoStatus,
} from "@/lib/room/types";

export type AuditRun = { projectId: string; pct: number } | null;

export type State = {
  /** The role the UI is showing (an admin can preview "member"). */
  role: Role;
  activeId: string | null;
  projects: Project[];
  todos: Record<string, Todo[]>;
  chronicle: Record<string, ChronicleEntry[]>;
  assets: Record<string, Asset[]>;
  knowledge: KnowledgeItem[];
  threads: Record<string, Message[]>;
  reports: Record<string, ReportData>;
  approved: Record<string, boolean>;
  builds: Record<string, Build[]>;
  intake: IntakeState | null;
  intakeLog: Message[];
  audit: AuditRun;
  /** Per-brand API key metadata keyed by project.id (slug). Secret values never reach the client. */
  brandKeys: Record<string, Partial<Record<ProviderId, OwnKey>>>;
};

// Reducers stay pure: every id is minted by the caller and travels inside the action.
type Action =
  | { t: "role"; role: Role }
  | { t: "open"; id: string | null }
  | { t: "intake"; state: IntakeState | null; log?: Message[] }
  | { t: "intakeLog"; msg: Message }
  | { t: "projectSave"; project: Project }
  | { t: "projectsLoaded"; projects: Project[] }
  | { t: "brandKeysLoaded"; projectId: string; keys: Partial<Record<ProviderId, OwnKey>> }
  | { t: "brandKeySet"; projectId: string; providerId: ProviderId; key: OwnKey }
  | { t: "brandKeyRemoved"; projectId: string; providerId: ProviderId }
  | { t: "projectCreate"; project: Project; welcome: Message; cid: string }
  | { t: "lock"; id: string; cid: string; msg: Message }
  | { t: "todoStatus"; id: string; todoId: string; status: TodoStatus; cid: string }
  | { t: "todoAdd"; id: string; todo: Todo; cid: string }
  | { t: "todoAssign"; id: string; todoId: string; assignee: string }
  | { t: "chronicle"; id: string; entry: ChronicleEntry }
  | { t: "pin"; id: string }
  | { t: "asset"; id: string; asset: Asset; cid: string }
  | { t: "assetContext"; id: string; assetId: string }
  | { t: "msg"; id: string; msg: Message }
  | { t: "msgPatch"; id: string; msgId: string; patch: Partial<Message> }
  | { t: "approve"; id: string; cid: string }
  | { t: "audit"; audit: AuditRun }
  | { t: "auditDone"; id: string; report: ReportData; todos: Todo[]; cid: string; msg: Message }
  | { t: "build"; id: string; build: Build; cid: string }
  | { t: "buildAdvance"; id: string; buildId: string; cid: string; aid: string };

const entry = (cid: string, kind: ChronicleKind, text: string): ChronicleEntry => ({ id: cid, kind, text, when: "Just now" });
const prepend = (m: Record<string, ChronicleEntry[]>, id: string, e: ChronicleEntry) => ({ ...m, [id]: [e, ...(m[id] ?? [])] });
const patchProject = (ps: Project[], id: string, f: (p: Project) => Project) => ps.map((p) => (p.id === id ? f(p) : p));

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "role":
      return { ...s, role: a.role };
    case "open":
      return { ...s, activeId: a.id, intake: a.id ? null : s.intake };
    case "intake":
      return { ...s, intake: a.state, intakeLog: a.log ?? (a.state ? s.intakeLog : []), activeId: a.state ? null : s.activeId };
    case "intakeLog":
      return { ...s, intakeLog: [...s.intakeLog, a.msg] };
    case "projectSave": {
      const exists = s.projects.some((p) => p.id === a.project.id);
      return { ...s, projects: exists ? s.projects.map((p) => (p.id === a.project.id ? a.project : p)) : [...s.projects, a.project] };
    }
    case "projectsLoaded":
      return { ...s, projects: [...a.projects, ...s.projects.filter((p) => !a.projects.some((l) => l.id === p.id))] };
    case "brandKeysLoaded":
      return { ...s, brandKeys: { ...s.brandKeys, [a.projectId]: a.keys } };
    case "brandKeySet": {
      const existing = s.brandKeys[a.projectId] ?? {};
      return { ...s, brandKeys: { ...s.brandKeys, [a.projectId]: { ...existing, [a.providerId]: a.key } } };
    }
    case "brandKeyRemoved": {
      const next = { ...(s.brandKeys[a.projectId] ?? {}) };
      delete next[a.providerId];
      return { ...s, brandKeys: { ...s.brandKeys, [a.projectId]: next } };
    }
    case "projectCreate": {
      const exists = s.projects.some((p) => p.id === a.project.id);
      const projects = exists ? s.projects.map((p) => (p.id === a.project.id ? a.project : p)) : [...s.projects, a.project];
      return {
        ...s,
        projects,
        activeId: a.project.id,
        intake: null,
        intakeLog: [],
        todos: { ...s.todos, [a.project.id]: s.todos[a.project.id] ?? [] },
        threads: { ...s.threads, [a.project.id]: [{ id: `${a.cid}-t`, role: "system", text: `Thread started · ${a.project.name} · Profile (draft)` }, a.welcome] },
        chronicle: prepend(s.chronicle, a.project.id, entry(a.cid, "note", "Brand created from the guided intake")),
      };
    }
    case "lock":
      return {
        ...s,
        projects: patchProject(s.projects, a.id, (p) => ({ ...p, locked: true, profileVersion: (p.profileVersion ?? 0) + 1, lastActivity: "Just now" })),
        chronicle: prepend(s.chronicle, a.id, entry(a.cid, "profile", "Profile locked (positioning line approved)")),
        threads: { ...s.threads, [a.id]: [...(s.threads[a.id] ?? []), a.msg] },
      };
    case "todoStatus": {
      const list = s.todos[a.id] ?? [];
      const t = list.find((x) => x.id === a.todoId);
      if (!t || t.status === a.status) return s;
      // every move is a decision worth keeping (approved, rejected, done, reopened), so every move is written
      return {
        ...s,
        todos: { ...s.todos, [a.id]: list.map((x) => (x.id === a.todoId ? { ...x, status: a.status } : x)) },
        chronicle: prepend(s.chronicle, a.id, entry(a.cid, "todo", statusChronicle(a.status, t.title))),
      };
    }
    case "todoAdd":
      return {
        ...s,
        todos: { ...s.todos, [a.id]: [...(s.todos[a.id] ?? []), a.todo] },
        chronicle: prepend(s.chronicle, a.id, entry(a.cid, "todo", `To do added: ${a.todo.title}`)),
      };
    case "todoAssign":
      return { ...s, todos: { ...s.todos, [a.id]: (s.todos[a.id] ?? []).map((t) => (t.id === a.todoId ? { ...t, assignee: a.assignee || undefined } : t)) } };
    case "chronicle":
      return { ...s, chronicle: prepend(s.chronicle, a.id, a.entry) };
    case "pin":
      return { ...s, knowledge: s.knowledge.map((k) => (k.id === a.id && !k.failed ? { ...k, pinned: !k.pinned } : k)) };
    case "asset":
      return {
        ...s,
        assets: { ...s.assets, [a.id]: [a.asset, ...(s.assets[a.id] ?? [])] },
        chronicle: prepend(s.chronicle, a.id, entry(a.cid, "file", `File added: ${a.asset.title}`)),
      };
    case "assetContext":
      return { ...s, assets: { ...s.assets, [a.id]: (s.assets[a.id] ?? []).map((x) => (x.id === a.assetId ? { ...x, useAsContext: !x.useAsContext } : x)) } };
    case "msg":
      return { ...s, threads: { ...s.threads, [a.id]: [...(s.threads[a.id] ?? []), a.msg] } };
    case "msgPatch":
      return { ...s, threads: { ...s.threads, [a.id]: (s.threads[a.id] ?? []).map((m) => (m.id === a.msgId ? { ...m, ...a.patch } : m)) } };
    case "approve":
      return { ...s, approved: { ...s.approved, [a.id]: true }, chronicle: prepend(s.chronicle, a.id, entry(a.cid, "report", `Report #${s.reports[a.id]?.audit ?? 1} approved`)) };
    case "audit":
      return { ...s, audit: a.audit };
    case "auditDone":
      return {
        ...s,
        audit: null,
        reports: { ...s.reports, [a.id]: a.report },
        approved: { ...s.approved, [a.id]: false },
        todos: a.todos.length ? { ...s.todos, [a.id]: [...a.todos, ...(s.todos[a.id] ?? [])] } : s.todos,
        projects: patchProject(s.projects, a.id, (p) => ({ ...p, score: a.report.score, lastActivity: "Just now" })),
        chronicle: prepend(s.chronicle, a.id, entry(a.cid, "audit", `Audit #${a.report.audit} finished — score ${a.report.score}`)),
        threads: { ...s.threads, [a.id]: [...(s.threads[a.id] ?? []), a.msg] },
      };
    case "build":
      return { ...s, builds: { ...s.builds, [a.id]: [a.build, ...(s.builds[a.id] ?? [])] }, chronicle: prepend(s.chronicle, a.id, entry(a.cid, "build", `Build started: ${a.build.title}`)) };
    case "buildAdvance": {
      const list = s.builds[a.id] ?? [];
      const b = list.find((x) => x.id === a.buildId);
      if (!b || b.stage === "published") return s;
      const stage = b.stage === "draft" ? "review" : "published";
      const next = { ...s, builds: { ...s.builds, [a.id]: list.map((x) => (x.id === a.buildId ? { ...x, stage } : x)) } } as State;
      if (stage !== "published") return next;
      // publishing marks the to do done, writes the chronicle and saves the output back as an asset
      return {
        ...next,
        todos: { ...s.todos, [a.id]: (s.todos[a.id] ?? []).map((t) => (t.id === b.todoId ? { ...t, status: "done" as const } : t)) },
        assets: { ...s.assets, [a.id]: [{ id: a.aid, title: `${b.title} v${b.version}.html`, kind: "document", tags: ["build", "published"], byBuilder: true }, ...(s.assets[a.id] ?? [])] },
        chronicle: prepend(s.chronicle, a.id, entry(a.cid, "build", `Build published: ${b.title}`)),
      };
    }
  }
}

const uid = () => Math.random().toString(36).slice(2, 9);

function initialState(role: Role): State {
  return {
    role,
    activeId: null,
    projects: INITIAL_PROJECTS,
    todos: INITIAL_TODOS,
    chronicle: INITIAL_CHRONICLE,
    assets: INITIAL_ASSETS,
    knowledge: INITIAL_KNOWLEDGE,
    threads: SEED_THREADS,
    reports: REPORTS,
    approved: {},
    builds: {},
    intake: null,
    intakeLog: [],
    audit: null,
    brandKeys: {},
  };
}

export type RoomApi = {
  state: State;
  basePath: string;
  href: (path: string) => string;
  /** True only for a real admin — they may preview the member view; a real member cannot elevate. */
  canPreviewRole: boolean;
  activeProject: Project | null;
  toastText: string | null;
  toast: (text: string) => void;
  uid: () => string;
  setRole: (r: Role) => void;
  open: (id: string | null) => void;
  setIntake: (s: IntakeState | null, log?: Message[]) => void;
  logIntake: (m: Message) => void;
  saveProject: (p: Project) => void;
  createProject: (p: Project, welcome: Message) => void;
  lockProfile: (id: string, msg: Message) => void;
  setBrandKey: (projectId: string, providerId: ProviderId, key: OwnKey) => void;
  deleteBrandKey: (projectId: string, providerId: ProviderId) => void;
  setTodoStatus: (id: string, todoId: string, status: TodoStatus) => void;
  addTodo: (id: string, title: string) => void;
  assignTodo: (id: string, todoId: string, assignee: string) => void;
  addChronicle: (id: string, kind: ChronicleKind, text: string) => void;
  togglePin: (id: string) => void;
  addAsset: (id: string, asset: Omit<Asset, "id">) => void;
  toggleAssetContext: (id: string, assetId: string) => void;
  addMessage: (id: string, m: Omit<Message, "id"> & { id?: string }) => string;
  patchMessage: (id: string, msgId: string, patch: Partial<Message>) => void;
  approveReport: (id: string) => void;
  startAudit: (id: string) => void;
  startBuild: (id: string, todo: Todo) => void;
  advanceBuild: (id: string, buildId: string) => void;
};

const Ctx = createContext<RoomApi | null>(null);

export function useRoom(): RoomApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoom must be used inside <RoomProvider>");
  return v;
}

export function RoomProvider({
  basePath,
  realRole,
  children,
}: {
  basePath: string;
  realRole: Role;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, realRole, initialState);
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  }, [state]);

  // Load brands from DB on mount; load each brand's key metadata once brands are known.
  useEffect(() => {
    loadBrands().then((brands) => {
      if (brands.length) dispatch({ t: "projectsLoaded", projects: brands });
      for (const brand of brands) {
        if (!brand.dbId) continue;
        loadBrandKeys(brand.dbId).then((keys) => {
          dispatch({ t: "brandKeysLoaded", projectId: brand.id, keys });
        });
      }
    });
  }, []);

  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const finishAudit = useCallback(
    (id: string) => {
      const cur = ref.current;
      const project = cur.projects.find((p) => p.id === id);
      if (!project) return dispatch({ t: "audit", audit: null });
      const prev = cur.reports[id];
      const report = nextReport(project.name, prev);
      const todos = prev ? [] : todosFromReport(report, uid);
      const msg: Message = {
        id: uid(),
        role: "assistant",
        text: `Audit #${report.audit} finished — score ${report.score}${prev ? ` (${report.score - prev.score >= 0 ? "+" : ""}${report.score - prev.score})` : ""}. The report is a draft until an admin approves it.${todos.length ? ` I added ${todos.length} to dos to Week 1.` : ""}`,
        used: [{ kind: "report", label: `Report · audit #${report.audit}` }],
      };
      dispatch({ t: "auditDone", id, report, todos, cid: uid(), msg });
      toast(`Audit #${report.audit} finished — score ${report.score}`);
    },
    [toast],
  );

  // one audit at a time; progress ticks until it completes (live spend against the $3 budget)
  const auditId = state.audit?.projectId ?? null;
  useEffect(() => {
    if (!auditId) return;
    const timer = setInterval(() => {
      const cur = ref.current.audit;
      if (!cur) return clearInterval(timer);
      const pct = Math.min(100, cur.pct + 11 + Math.round(Math.random() * 9));
      if (pct >= 100) {
        clearInterval(timer);
        finishAudit(cur.projectId);
      } else dispatch({ t: "audit", audit: { projectId: cur.projectId, pct } });
    }, 450);
    return () => clearInterval(timer);
  }, [auditId, finishAudit]);

  const api = useMemo<RoomApi>(() => {
    const act = state.activeId ? state.projects.find((p) => p.id === state.activeId) ?? null : null;
    return {
      state,
      basePath,
      href: (path) => `${basePath}${path}`,
      canPreviewRole: realRole === "admin",
      activeProject: act,
      toastText,
      toast,
      uid,
      setRole: (role) => dispatch({ t: "role", role }),
      open: (id) => dispatch({ t: "open", id }),
      setIntake: (s, log) => dispatch({ t: "intake", state: s, log }),
      logIntake: (msg) => dispatch({ t: "intakeLog", msg }),
      saveProject: (project) => dispatch({ t: "projectSave", project }),
      createProject: (project, welcome) => dispatch({ t: "projectCreate", project, welcome, cid: uid() }),
      lockProfile: (id, msg) => dispatch({ t: "lock", id, cid: uid(), msg }),
      setBrandKey: (projectId, providerId, key) => dispatch({ t: "brandKeySet", projectId, providerId, key }),
      deleteBrandKey: (projectId, providerId) => dispatch({ t: "brandKeyRemoved", projectId, providerId }),
      setTodoStatus: (id, todoId, status) => dispatch({ t: "todoStatus", id, todoId, status, cid: uid() }),
      addTodo: (id, title) => dispatch({ t: "todoAdd", id, todo: { id: uid(), title, group: "manual", status: "progress" }, cid: uid() }),
      assignTodo: (id, todoId, assignee) => dispatch({ t: "todoAssign", id, todoId, assignee }),
      addChronicle: (id, kind, text) => dispatch({ t: "chronicle", id, entry: entry(uid(), kind, text) }),
      togglePin: (id) => dispatch({ t: "pin", id }),
      addAsset: (id, asset) => dispatch({ t: "asset", id, asset: { ...asset, id: uid() }, cid: uid() }),
      toggleAssetContext: (id, assetId) => dispatch({ t: "assetContext", id, assetId }),
      addMessage: (id, m) => {
        const mid = m.id ?? uid();
        dispatch({ t: "msg", id, msg: { ...m, id: mid } });
        return mid;
      },
      patchMessage: (id, msgId, patch) => dispatch({ t: "msgPatch", id, msgId, patch }),
      approveReport: (id) => dispatch({ t: "approve", id, cid: uid() }),
      startAudit: (id) => {
        if (ref.current.audit) return;
        dispatch({ t: "audit", audit: { projectId: id, pct: 0 } });
      },
      startBuild: (id, todo) =>
        dispatch({
          t: "build",
          id,
          cid: uid(),
          build: { id: uid(), todoId: todo.id, title: todo.title, kind: /content/i.test(todo.service ?? "") ? "content" : "web", stage: "draft", version: 1 },
        }),
      advanceBuild: (id, buildId) => dispatch({ t: "buildAdvance", id, buildId, cid: uid(), aid: uid() }),
    };
  }, [state, basePath, realRole, toastText, toast]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
