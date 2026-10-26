"use client";

// Setting tab (admin only): what the AI can use, what it can spend, and how the pipeline runs.
// Prototype: every control is live in the page but nothing is saved, and no key value is ever shown.

import { useState } from "react";
import { Check, Lock, Mail, Pin, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoom } from "./room-provider";
import { Alert, Btn, Card, Chip, EmptyState, PageHeader, errorCls, inputCls, labelCls, motion, pageX, pillCls } from "./ui";

type Key = { id: string; provider: string; last4: string; cap: number; active: boolean };
type User = { email: string; role: "admin" | "member"; lang: "id" | "en"; status: "active" | "invited" | "disabled" };

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-4">
      <h2 id={id} className="font-title text-h3 text-ink-800">{title}</h2>
      {hint && <p className="mb-5 mt-2 max-w-chat text-pretty text-[14px] leading-[1.5] text-ink-500">{hint}</p>}
      <Card className={hint ? "" : "mt-5"}>{children}</Card>
    </section>
  );
}

/** A list inside a card: rows are 64px, rounded, Paper on hover, with no rules between them (BRAND "Table / list"). */
const list = "-mx-2 sm:-mx-4";
const row = cn("flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 rounded-field px-4 py-3 hover:bg-paper-100", motion);

export function SettingsScreen() {
  const { state, togglePin, toast } = useRoom();
  const [log, setLog] = useState<string[]>([]);
  const record = (text: string) => setLog((l) => [text, ...l].slice(0, 12));

  const [keys, setKeys] = useState<Key[]>([
    { id: "claude", provider: "Claude (Anthropic)", last4: "a91f", cap: 60, active: true },
    { id: "gemini", provider: "Google Gemini", last4: "k2Q8", cap: 20, active: true },
    { id: "perplexity", provider: "Perplexity", last4: "7c3d", cap: 15, active: true },
    { id: "dataforseo", provider: "DataForSEO", last4: "0b2e", cap: 30, active: false },
  ]);
  const [cost, setCost] = useState({ budget: "3.00", alert: "80", chatCap: "40", markup: "30", hardStop: true });
  const [users, setUsers] = useState<User[]>([
    { email: "dewi@example.com", role: "admin", lang: "id", status: "active" },
    { email: "andre@example.com", role: "member", lang: "id", status: "active" },
    { email: "sari@example.com", role: "member", lang: "en", status: "active" },
  ]);
  const [invite, setInvite] = useState({ email: "", role: "member" as User["role"], lang: "id" as User["lang"] });
  const [inviteErr, setInviteErr] = useState<string | undefined>();
  const [prompts, setPrompts] = useState([
    { id: "intake", name: "Intake extraction", versions: ["v3", "v2", "v1"], active: "v3" },
    { id: "audit", name: "Audit scoring", versions: ["v5", "v4", "v3"], active: "v5" },
    { id: "chat", name: "Chat grounding", versions: ["v2", "v1"], active: "v2" },
  ]);

  if (state.role !== "admin") {
    return (
      <div className={cn("mx-auto max-w-3xl py-12", pageX)}>
        <EmptyState icon={<Lock className="size-5" />} title="Setting is admin-only" hint="Members can read most of the product but can't change keys, budgets, users or prompts — and never see keys at all." />
      </div>
    );
  }

  const activeAdmins = users.filter((u) => u.role === "admin" && u.status === "active").length;
  const lastAdmin = (u: User) => u.role === "admin" && u.status === "active" && activeAdmins <= 1;
  const items = state.knowledge.filter((k) => k.scope === "workspace" || k.projectId);

  return (
    <div className={cn("mx-auto max-w-4xl space-y-16 py-10 sm:py-12", pageX)}>
      <div>
        <PageHeader title="Setting" description="Control what the AI can use, what it can spend and how the pipeline runs. Nothing here needs a deploy." />
        <Alert tone="warn" title="Prototype:" className="-mt-2">
          these controls respond but nothing is saved. In the product, keys live in Supabase Vault — the table keeps only a reference and the last 4 characters, and the UI never shows or returns a key.
        </Alert>
      </div>

      <Section id="keys" title="API keys" hint="Add a key per provider, test it, set a monthly cap, disable it. These are the workspace keys: a brand without keys of its own uses them. A brand can bring its own under Project → Integrations.">
        <ul className={list}>
          {keys.map((k) => (
            <li key={k.id} className={row}>
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-semibold">{k.provider}</p>
                <p className="mt-0.5 font-mono text-[13px] text-ink-500">••••••••{k.last4} · cap ${k.cap}/month</p>
              </div>
              <Chip tone={k.active ? "ok" : "neutral"}>{k.active ? "Active" : "Disabled"}</Chip>
              <div className="flex gap-2">
                <Btn size="xs" variant="secondary" onClick={() => { toast(`${k.provider}: test passed (prototype)`); record(`Tested the ${k.provider} key`); }}>Test key</Btn>
                <Btn size="xs" variant={k.active ? "danger" : "secondary"} onClick={() => { setKeys((ks) => ks.map((x) => (x.id === k.id ? { ...x, active: !x.active } : x))); record(`${k.active ? "Disabled" : "Enabled"} the ${k.provider} key`); }}>
                  {k.active ? "Disable key" : "Enable key"}
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="cost" title="Cost" hint="A batch copies its cost profile when it starts, so editing never changes a run in progress.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            record(`Saved the cost profile: $${cost.budget} run budget, alert at ${cost.alert}%`);
            toast("Cost profile saved (prototype)");
          }}
          className="grid gap-6 sm:grid-cols-2"
        >
          {[
            ["budget", "Run budget per brand (USD)"],
            ["alert", "Alert level (% of budget)"],
            ["chatCap", "Monthly chat cap per project (USD)"],
            ["markup", "Builder markup (%)"],
          ].map(([k, label]) => (
            <div key={k}>
              <label htmlFor={`cost-${k}`} className={labelCls}>{label}</label>
              <input id={`cost-${k}`} inputMode="decimal" value={cost[k as "budget"]} onChange={(e) => setCost({ ...cost, [k]: e.target.value })} className={cn(inputCls, "font-mono")} />
            </div>
          ))}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] sm:col-span-2">
            <span className="relative inline-flex size-6 shrink-0">
              <input type="checkbox" checked={cost.hardStop} onChange={(e) => setCost({ ...cost, hardStop: e.target.checked })} className={cn("peer absolute inset-0 size-6 cursor-pointer appearance-none rounded-lg border-[1.5px] border-ink-200 bg-paper-0 checked:border-brand-500 checked:bg-brand-500", motion)} />
              <Check className="pointer-events-none absolute inset-1 size-4 text-ink-800 opacity-0 peer-checked:opacity-100" aria-hidden />
            </span>
            Hard stop: end a run that reaches its budget and keep what it measured
          </label>
          <div className="sm:col-span-2">
            <Btn type="submit" size="lg" variant="primary">Save cost profile</Btn>
          </div>
        </form>
      </Section>

      <Section id="knowledge" title="Knowledge" hint="Memory the AI can use. Pinned items count against the context budget; unpinned items are searchable on demand.">
        <ul className={list}>
          {items.map((k) => (
            <li key={k.id} className={row}>
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-semibold">{k.title}</p>
                <p className="mt-0.5 text-[13px] text-ink-500">
                  {k.scope === "workspace" ? "Workspace" : "Project"} · {k.failed ? <span className="text-danger">failed: {k.failed}</span> : <span className="font-mono">{k.tokens} tokens · ready</span>}
                </p>
              </div>
              <button
                type="button"
                aria-pressed={k.pinned}
                disabled={!!k.failed}
                onClick={() => { togglePin(k.id); record(`${k.pinned ? "Unpinned" : "Pinned"} “${k.title}”`); }}
                className={cn(
                  "hit-44 inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[13px] font-semibold leading-none disabled:pointer-events-none disabled:border-transparent disabled:bg-ink-100 disabled:text-ink-300",
                  motion,
                  k.pinned ? "border-ink-800 bg-ink-800 text-paper-100 hover:bg-ink-700" : "border-ink-200 text-ink-800 hover:bg-paper-0",
                )}
              >
                <Pin className="size-4" aria-hidden /> {k.pinned ? "Pinned" : "Pin"}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] leading-[1.5] text-ink-500">Upload flow: file → private bucket → text extracted → short summary and token estimate → ready. A failed extraction shows its reason instead of silently going missing.</p>
      </Section>

      <Section id="prompts" title="Workflow and prompts" hint="Edit as drafts, then activate. One active version per prompt; older versions stay, so rollback is activating an older one.">
        <ul className={list}>
          {prompts.map((p) => (
            <li key={p.id} className={row}>
              <p className="min-w-0 flex-1 basis-48 font-semibold">{p.name}</p>
              <div role="radiogroup" aria-label={`${p.name} active version`} className="flex flex-wrap gap-2">
                {p.versions.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={p.active === v}
                    onClick={() => { setPrompts((ps) => ps.map((x) => (x.id === p.id ? { ...x, active: v } : x))); record(`Activated ${p.name} ${v}`); }}
                    className={cn(pillCls(p.active === v), "font-mono", p.active !== v && "hover:bg-paper-0")}
                  >
                    {v}{p.active === v ? " · active" : ""}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="users" title="Users" hint="Invite by email, pick a role and a language. There is always at least one active admin.">
        <ul className={list}>
          {users.map((u) => (
            <li key={u.email} className={row}>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-semibold">{u.email}</p>
                <p className="mt-0.5 text-[13px] text-ink-500">{u.role} · {u.lang === "id" ? "Bahasa Indonesia" : "English"}</p>
              </div>
              <Chip tone={u.status === "active" ? "ok" : u.status === "invited" ? "info" : "neutral"}>{u.status}</Chip>
              <div className="flex gap-2">
                <Btn
                  size="xs"
                  variant="secondary"
                  disabled={lastAdmin(u)}
                  title={lastAdmin(u) ? "There is always at least one active admin" : undefined}
                  onClick={() => { setUsers((us) => us.map((x) => (x.email === u.email ? { ...x, status: x.status === "disabled" ? "active" : "disabled" } : x))); record(`${u.status === "disabled" ? "Re-enabled" : "Disabled"} ${u.email}`); }}
                >
                  {u.status === "disabled" ? "Enable user" : "Disable user"}
                </Btn>
                <Btn
                  size="xs"
                  variant="danger"
                  disabled={lastAdmin(u)}
                  title={lastAdmin(u) ? "The last admin can't be removed" : undefined}
                  onClick={() => { setUsers((us) => us.filter((x) => x.email !== u.email)); record(`Removed ${u.email}`); }}
                >
                  Remove user
                </Btn>
              </div>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const email = invite.email.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setInviteErr("Enter a valid email address.");
            if (users.some((u) => u.email === email)) return setInviteErr("That person is already on the list.");
            setUsers((us) => [...us, { email, role: invite.role, lang: invite.lang, status: "invited" }]);
            record(`Invited ${email} as ${invite.role}`);
            setInvite({ email: "", role: "member", lang: "id" });
            setInviteErr(undefined);
            toast("Invitation recorded (prototype: no email sent)");
          }}
          noValidate
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          <div>
            <label htmlFor="inv-email" className="sr-only">Email to invite</label>
            <input id="inv-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@company.com" className={inputCls} aria-invalid={!!inviteErr} aria-describedby={inviteErr ? "inv-email-err" : undefined} />
            {inviteErr && <p id="inv-email-err" role="alert" className={errorCls}>{inviteErr}</p>}
          </div>
          <select aria-label="Role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as User["role"] })} className={cn(inputCls, "sm:w-36")}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <select aria-label="Language" value={invite.lang} onChange={(e) => setInvite({ ...invite, lang: e.target.value as User["lang"] })} className={cn(inputCls, "sm:w-48")}>
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
          <Btn type="submit" size="lg" variant="primary" className="sm:mt-1">Invite user</Btn>
        </form>
      </Section>

      <Section id="email" title="Email (Resend)" hint="Report emails and invitations come from your own verified domain.">
        <ol className="space-y-4 text-[15px]">
          {[
            ["Resend API key", "Stored in the vault, never shown back", true],
            ["Sending domain verified", "DNS records not detected yet — Resend only sends from a verified domain", false],
            ["Sender name, address and reply-to", "Entered", true],
            ["Templates in Bahasa Indonesia and English", "Report email and invitation, brand name and link filled in automatically", true],
          ].map(([t, d, ok]) => (
            <li key={t as string} className="flex items-start gap-3">
              {ok ? (
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-ink">
                  <ShieldCheck className="size-4" aria-label="Done" />
                </span>
              ) : (
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-bg text-ink-800">
                  <TriangleAlert className="size-4" aria-label="Needs attention" />
                </span>
              )}
              <span className="pt-0.5 leading-[1.5]"><span className="font-semibold">{t as string}</span> <span className="text-ink-500">· {d as string}</span></span>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Btn variant="secondary" onClick={() => { toast("Test email sent to your own address (prototype)"); record("Sent a test email"); }}>
            <Mail className="size-4" aria-hidden /> Send test email
          </Btn>
        </div>
        <p className="mt-4 text-[13px] leading-[1.5] text-ink-500">Tip: point Supabase Auth&apos;s SMTP at Resend too, so password and invitation emails also come from your domain.</p>
      </Section>

      <Section id="audit-log" title="Audit log" hint="Every change to users, keys, settings and templates is written here. Only admins can read it.">
        {log.length === 0 ? (
          <p className="text-[14px] text-ink-500">No changes in this session yet.</p>
        ) : (
          <ol className="space-y-3 text-[15px]" aria-label="Changes">
            {log.map((l, i) => (
              <li key={`${l}-${i}`} className="flex items-baseline gap-4">
                <span className="w-16 shrink-0 font-mono text-[12px] text-ink-500">just now</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
