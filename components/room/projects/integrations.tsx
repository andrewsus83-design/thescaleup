"use client";

// Project → Integrations: a brand can bring its own API keys. A provider with an own key bills that brand's usage to the
// brand's own account; without one the brand runs on the workspace key (Setting → API keys) and the usage is charged to the
// workspace. Either way the spend is tracked per brand, so the cost of one brand is one glance away.
//
// Prototype: keys live in this page's memory only. The full key is discarded the moment the form closes, only the last 4
// characters are kept, nothing is sent anywhere, and members never see a key (not even those 4 characters) or change one.
// The spend figures are sample data (see brand-keys.ts).

import { useState } from "react";
import { KeyRound } from "lucide-react";
import type { Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Alert, Bar, Btn, BudgetPanel, Card, Chip, Sheet, errorCls, inputCls, labelCls } from "../ui";
import { PROVIDERS, WORKSPACE_CAP, costSplit, spendOf, usd, type BrandKeys, type OwnKey, type ProviderId } from "./brand-keys";

const meterTone = (pct: number) => (pct >= 95 ? "bad" : pct >= 80 ? "warn" : "brand");
const nameOf = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

export function IntegrationsTab({ project, keys, onChange }: { project: Project; keys: BrandKeys; onChange: (next: BrandKeys) => void }) {
  const api = useRoom();
  const isAdmin = api.state.role === "admin";
  const [editing, setEditing] = useState<ProviderId | null>(null);
  const [removing, setRemoving] = useState<ProviderId | null>(null);

  const set = (id: ProviderId, key: OwnKey | undefined) => {
    const next = { ...keys };
    if (key) next[id] = key;
    else delete next[id];
    onChange(next);
  };
  /** Every key change lands in the brand's chronicle (without the key) and shows a toast. */
  const log = (text: string, toast = text) => {
    api.addChronicle(project.id, "settings", text);
    api.toast(toast);
  };

  const { own, workspace } = costSplit(project.id, keys);
  const wsPct = (workspace / WORKSPACE_CAP) * 100;

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Integrations and cost</h2>
      <BudgetPanel label={`Cost this month · ${project.name}`} figure={usd(own + workspace)} unit="total usage">
        <div className="space-y-4 text-[13px]">
          <div>
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-ink-300">Charged to the workspace</span>
              <span className="font-mono">
                {usd(workspace)} <span className="text-ink-300">of {usd(WORKSPACE_CAP)} cap</span>
              </span>
            </p>
            <div className="mt-2">
              <Bar value={workspace} max={WORKSPACE_CAP} tone={meterTone(wsPct)} label={`Workspace spend on ${project.name} against its monthly cap`} onDark />
            </div>
          </div>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-ink-300">Billed to the brand&apos;s own keys</span>
            <span className="font-mono">{usd(own)}</span>
          </p>
        </div>
      </BudgetPanel>

      {isAdmin ? (
        <p className="max-w-chat text-pretty text-[14px] leading-[1.5] text-ink-500">
          Add a key per provider and {project.name} runs on its own account: the usage is billed to the brand and counted here. Without a key it uses the workspace key and is charged to the workspace.
        </p>
      ) : (
        <Alert tone="info">Only an admin can add or change keys. You can see which providers run on a brand key and what each one cost.</Alert>
      )}

      <ul className="grid gap-6 md:grid-cols-2" aria-label="Providers">
        {PROVIDERS.map((p) => {
          const k = keys[p.id];
          const spend = spendOf(project.id, p.id);
          return (
            <li key={p.id} className="flex">
              <Card small className="flex w-full flex-col">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-40">
                    <h3 className="font-title text-h3 text-ink-800">{p.name}</h3>
                    <p className="mt-1 text-[14px] leading-[1.5] text-ink-500">{p.use}</p>
                  </div>
                  {!k ? <Chip tone="neutral">Workspace key</Chip> : k.active ? <Chip tone="ok">Own key</Chip> : <Chip tone="warn">Own key off</Chip>}
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="label-caps text-ink-500">Key</dt>
                    <dd className="mt-1 font-mono text-[14px] text-ink-800">{k ? (isAdmin ? `••••••••${k.last4}` : "Brand key") : "Workspace"}</dd>
                  </div>
                  <div>
                    <dt className="label-caps text-ink-500">Cost this month</dt>
                    <dd className="mt-1 font-mono text-[14px] text-ink-800">
                      {usd(spend)}
                      {k?.active && <span className="text-ink-500"> / {usd(k.cap)}</span>}
                    </dd>
                  </div>
                </dl>
                {k?.active && (
                  <div className="mt-3">
                    <Bar value={spend} max={k.cap} tone={meterTone((spend / k.cap) * 100)} label={`${p.name} spend on ${project.name} against its cap`} />
                  </div>
                )}
                <p className="mt-4 text-[13px] leading-[1.5] text-ink-500">
                  {!k ? "Charged to the workspace key." : k.active ? `Billed to ${project.name}'s own ${p.name} account.` : "The own key is off, so this provider is charged to the workspace key."}
                </p>

                {isAdmin && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {!k ? (
                      <Btn size="xs" variant="secondary" onClick={() => setEditing(p.id)}>
                        <KeyRound className="size-4" aria-hidden /> Add own key
                      </Btn>
                    ) : (
                      <>
                        <Btn size="xs" variant="secondary" onClick={() => setEditing(p.id)}>
                          Replace key
                        </Btn>
                        <Btn size="xs" variant="secondary" onClick={() => api.toast(`${p.name}: test passed (prototype)`)}>
                          Test key
                        </Btn>
                        <Btn
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            set(p.id, { ...k, active: !k.active });
                            log(k.active ? `Own ${p.name} key switched off — using the workspace key` : `Own ${p.name} key switched on`);
                          }}
                        >
                          {k.active ? "Turn key off" : "Turn key on"}
                        </Btn>
                        <Btn size="xs" variant="danger" onClick={() => setRemoving(p.id)}>
                          Remove key
                        </Btn>
                      </>
                    )}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-[13px] leading-[1.5] text-ink-500">
        Prototype: keys stay in this page&apos;s memory only — the full key is dropped when the form closes, only the last 4 characters are kept, and nothing is sent anywhere. Spend figures are sample data.
      </p>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing ? `${nameOf(editing)} key` : "API key"}>
        {editing && (
          <KeyForm
            brand={project.name}
            provider={nameOf(editing)}
            current={keys[editing]}
            onCancel={() => setEditing(null)}
            onSave={(key) => {
              const replacing = !!keys[editing];
              set(editing, key);
              setEditing(null);
              log(replacing ? `Own ${nameOf(editing)} key replaced` : `Own ${nameOf(editing)} key added`, `${nameOf(editing)} key saved for ${project.name} (prototype: nothing was stored)`);
            }}
          />
        )}
      </Sheet>

      <Sheet open={removing !== null} onClose={() => setRemoving(null)} title="Remove this key?">
        {removing && (
          <div className="space-y-5 text-[15px]">
            <p className="leading-[1.6]">
              {project.name} goes back to the workspace key for {nameOf(removing)}. From then on its usage is charged to the workspace, not to the brand. You can add a key again at any time.
            </p>
            <div className="flex justify-end gap-3">
              <Btn variant="ghost" onClick={() => setRemoving(null)}>Cancel</Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  set(removing, undefined);
                  setRemoving(null);
                  log(`Own ${nameOf(removing)} key removed — back to the workspace key`);
                }}
              >
                Remove key
              </Btn>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Mounts only while the sheet is open, so the typed key is gone the moment it closes. */
function KeyForm({ brand, provider, current, onSave, onCancel }: { brand: string; provider: string; current?: OwnKey; onSave: (k: OwnKey) => void; onCancel: () => void }) {
  const [secret, setSecret] = useState("");
  const [cap, setCap] = useState(String(current?.cap ?? 20));
  const [errs, setErrs] = useState<{ key?: string; cap?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = secret.trim();
    const amount = Number(cap.replace(",", "."));
    const next: { key?: string; cap?: string } = {};
    if (key.length < 12) next.key = "That looks too short. Paste the whole key from the provider's dashboard.";
    if (!Number.isFinite(amount) || amount <= 0) next.cap = "Enter a monthly cap in USD, for example 25.";
    setErrs(next);
    if (next.key || next.cap) return;
    onSave({ last4: key.slice(-4), cap: amount, active: true });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5 text-[15px]">
      <p className="leading-[1.6] text-ink-500">
        {brand}&apos;s {provider} usage is billed to the account that owns this key.
      </p>
      <div>
        <label htmlFor="brand-key" className={labelCls}>API key</label>
        <input
          id="brand-key"
          name="brand-api-key"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Paste the key"
          className={cn(inputCls, "font-mono")}
          aria-invalid={!!errs.key}
          aria-describedby={errs.key ? "brand-key-err brand-key-hint" : "brand-key-hint"}
        />
        {errs.key && <p id="brand-key-err" role="alert" className={errorCls}>{errs.key}</p>}
        <p id="brand-key-hint" className="mt-2 text-[13px] leading-[1.5] text-ink-500">It goes to the vault and is never shown again — only its last 4 characters.</p>
      </div>
      <div>
        <label htmlFor="brand-cap" className={labelCls}>Monthly cap for this brand (USD)</label>
        <input id="brand-cap" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className={cn(inputCls, "font-mono")} aria-invalid={!!errs.cap} aria-describedby={errs.cap ? "brand-cap-err" : undefined} />
        {errs.cap && <p id="brand-cap-err" role="alert" className={errorCls}>{errs.cap}</p>}
      </div>
      <div className="flex justify-end gap-3">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn type="submit" variant="primary">Save key</Btn>
      </div>
    </form>
  );
}
