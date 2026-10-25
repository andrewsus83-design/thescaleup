"use client";

// Setting tab (admin only): what the AI can use, what it can spend, and how the pipeline runs.
// Prototype: every control is live in the page but nothing is saved, and no key value is ever shown.

import { useState } from "react";
import { Lock, Mail, Pin, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { useRoom } from "./room-provider";
import { Btn, Chip, inputCls } from "./ui";

type Key = { id: string; provider: string; last4: string; cap: number; active: boolean };
type User = { email: string; role: "admin" | "member"; lang: "id" | "en"; status: "active" | "invited" | "disabled" };

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-4">
      <h2 id={id} className="font-display text-lg font-bold">{title}</h2>
      {hint && <p className="mb-3 mt-1 text-sm text-slate-400">{hint}</p>}
      <Card className={hint ? "" : "mt-3"}>{children}</Card>
    </section>
  );
}

const field = "block text-xs font-semibold text-slate-300";

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
      <div className="mx-auto max-w-3xl px-5 py-10">
        <EmptyState icon={<Lock className="h-5 w-5" />} title="Setting is admin-only" hint="Members can read most of the product but can't change keys, budgets, users or prompts — and never see keys at all." />
      </div>
    );
  }

  const activeAdmins = users.filter((u) => u.role === "admin" && u.status === "active").length;
  const lastAdmin = (u: User) => u.role === "admin" && u.status === "active" && activeAdmins <= 1;
  const items = state.knowledge.filter((k) => k.scope === "workspace" || k.projectId);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-5 py-8">
      <PageHeader title="Setting" description="Control what the AI can use, what it can spend and how the pipeline runs. Nothing here needs a deploy." />
      <p className="-mt-4 flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/5 px-4 py-3 text-xs text-warn">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Prototype: these controls respond but nothing is saved. In the product, keys live in Supabase Vault — the table keeps only a reference and the last 4 characters, and the UI never shows or returns a key.
      </p>

      <Section id="keys" title="API keys" hint="Add a key per provider, test it, set a monthly cap, disable it.">
        <ul className="divide-y divide-white/8">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{k.provider}</p>
                <p className="font-mono text-xs text-slate-400">••••••••{k.last4} · cap ${k.cap}/month</p>
              </div>
              <Chip tone={k.active ? "good" : "neutral"}>{k.active ? "Active" : "Disabled"}</Chip>
              <Btn size="sm" variant="secondary" onClick={() => { toast(`${k.provider}: test passed (prototype)`); record(`Tested the ${k.provider} key`); }}>Test</Btn>
              <Btn size="sm" variant={k.active ? "danger" : "secondary"} onClick={() => { setKeys((ks) => ks.map((x) => (x.id === k.id ? { ...x, active: !x.active } : x))); record(`${k.active ? "Disabled" : "Enabled"} the ${k.provider} key`); }}>
                {k.active ? "Disable" : "Enable"}
              </Btn>
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
          className="grid gap-4 sm:grid-cols-2"
        >
          {[
            ["budget", "Run budget per brand (USD)"],
            ["alert", "Alert level (% of budget)"],
            ["chatCap", "Monthly chat cap per project (USD)"],
            ["markup", "Builder markup (%)"],
          ].map(([k, label]) => (
            <div key={k}>
              <label htmlFor={`cost-${k}`} className={field}>{label}</label>
              <input id={`cost-${k}`} inputMode="decimal" value={cost[k as "budget"]} onChange={(e) => setCost({ ...cost, [k]: e.target.value })} className={`${inputCls} mt-1.5`} />
            </div>
          ))}
          <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
            <input type="checkbox" checked={cost.hardStop} onChange={(e) => setCost({ ...cost, hardStop: e.target.checked })} className="h-4 w-4 accent-[var(--color-coral)]" />
            Hard stop: end a run that reaches its budget and keep what it measured
          </label>
          <div className="sm:col-span-2">
            <Btn type="submit" variant="primary">Save cost profile</Btn>
          </div>
        </form>
      </Section>

      <Section id="knowledge" title="Knowledge" hint="Memory the AI can use. Pinned items count against the context budget; unpinned items are searchable on demand.">
        <ul className="divide-y divide-white/8">
          {items.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{k.title}</p>
                <p className="text-xs text-slate-400">
                  {k.scope === "workspace" ? "Workspace" : "Project"} · {k.failed ? <span className="text-bad">failed: {k.failed}</span> : <span className="font-mono">{k.tokens} tokens · ready</span>}
                </p>
              </div>
              <button
                type="button"
                aria-pressed={k.pinned}
                disabled={!!k.failed}
                onClick={() => { togglePin(k.id); record(`${k.pinned ? "Unpinned" : "Pinned"} “${k.title}”`); }}
                className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 disabled:opacity-40", k.pinned ? "border-coral/40 bg-coral/10 text-coral" : "border-white/12 text-slate-300 hover:bg-white/5")}
              >
                <Pin className="h-3.5 w-3.5" aria-hidden /> {k.pinned ? "Pinned" : "Pin"}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">Upload flow: file → private bucket → text extracted → short summary and token estimate → ready. A failed extraction shows its reason instead of silently going missing.</p>
      </Section>

      <Section id="prompts" title="Workflow and prompts" hint="Edit as drafts, then activate. One active version per prompt; older versions stay, so rollback is activating an older one.">
        <ul className="divide-y divide-white/8">
          {prompts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <p className="min-w-0 flex-1 font-semibold">{p.name}</p>
              <div role="radiogroup" aria-label={`${p.name} active version`} className="flex gap-1.5">
                {p.versions.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={p.active === v}
                    onClick={() => { setPrompts((ps) => ps.map((x) => (x.id === p.id ? { ...x, active: v } : x))); record(`Activated ${p.name} ${v}`); }}
                    className={cn("rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70", p.active === v ? "border-coral/50 bg-coral/10 text-coral" : "border-white/12 text-slate-300 hover:bg-white/5")}
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
        <ul className="divide-y divide-white/8">
          {users.map((u) => (
            <li key={u.email} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{u.email}</p>
                <p className="text-xs text-slate-400">{u.role} · {u.lang === "id" ? "Bahasa Indonesia" : "English"}</p>
              </div>
              <Chip tone={u.status === "active" ? "good" : u.status === "invited" ? "info" : "neutral"}>{u.status}</Chip>
              <Btn
                size="sm"
                variant="secondary"
                disabled={lastAdmin(u)}
                title={lastAdmin(u) ? "There is always at least one active admin" : undefined}
                onClick={() => { setUsers((us) => us.map((x) => (x.email === u.email ? { ...x, status: x.status === "disabled" ? "active" : "disabled" } : x))); record(`${u.status === "disabled" ? "Re-enabled" : "Disabled"} ${u.email}`); }}
              >
                {u.status === "disabled" ? "Enable" : "Disable"}
              </Btn>
              <Btn
                size="sm"
                variant="danger"
                disabled={lastAdmin(u)}
                title={lastAdmin(u) ? "The last admin can't be removed" : undefined}
                onClick={() => { setUsers((us) => us.filter((x) => x.email !== u.email)); record(`Removed ${u.email}`); }}
              >
                Remove
              </Btn>
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
          className="mt-4 grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          <div>
            <label htmlFor="inv-email" className="sr-only">Email to invite</label>
            <input id="inv-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@company.com" className={inputCls} />
            {inviteErr && <p role="alert" className="mt-1.5 text-xs text-bad">{inviteErr}</p>}
          </div>
          <select aria-label="Role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as User["role"] })} className={`${inputCls} sm:w-32`}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <select aria-label="Language" value={invite.lang} onChange={(e) => setInvite({ ...invite, lang: e.target.value as User["lang"] })} className={`${inputCls} sm:w-44`}>
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
          <Btn type="submit" variant="primary">Invite</Btn>
        </form>
      </Section>

      <Section id="email" title="Email (Resend)" hint="Report emails and invitations come from your own verified domain.">
        <ol className="space-y-2.5 text-sm">
          {[
            ["Resend API key", "Stored in the vault, never shown back", true],
            ["Sending domain verified", "DNS records not detected yet — Resend only sends from a verified domain", false],
            ["Sender name, address and reply-to", "Entered", true],
            ["Templates in Bahasa Indonesia and English", "Report email and invitation, brand name and link filled in automatically", true],
          ].map(([t, d, ok]) => (
            <li key={t as string} className="flex items-start gap-3">
              {ok ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-label="Done" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="Needs attention" />}
              <span><span className="font-semibold">{t as string}</span> <span className="text-slate-400">· {d as string}</span></span>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <Btn variant="secondary" onClick={() => { toast("Test email sent to your own address (prototype)"); record("Sent a test email"); }}>
            <Mail className="h-4 w-4" aria-hidden /> Send test email
          </Btn>
        </div>
        <p className="mt-3 text-xs text-slate-400">Tip: point Supabase Auth&apos;s SMTP at Resend too, so password and invitation emails also come from your domain.</p>
      </Section>

      <Section id="audit-log" title="Audit log" hint="Every change to users, keys, settings and templates is written here. Only admins can read it.">
        {log.length === 0 ? (
          <p className="text-sm text-slate-400">No changes in this session yet.</p>
        ) : (
          <ol className="space-y-2 text-sm" aria-label="Changes">
            {log.map((l, i) => (
              <li key={`${l}-${i}`} className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">just now</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
