"use client";

// Project → Integrations: a brand can bring its own API keys. A provider with an own key bills that brand's usage to the
// brand's own account; without one the brand runs on the workspace key (Setting → API keys) and the usage is charged to the
// workspace. Either way the spend is tracked per brand, so the cost of one brand is one glance away.
//
// Every provider the product calls is listed (see the catalog in brand-keys.ts): AI models, search and AI-answer data,
// website tools, Zernio and Search Console, email and tracing. Search Console is a grant by the brand's owner, not a key.
//
// Keys are stored encrypted (AES-256-GCM) in report_client_settings. Only the last 4 characters are shown in the UI;
// the full key is never returned to the client. Members cannot see keys or change them. Spend figures are sample data.

import { useState } from "react";
import { KeyRound } from "lucide-react";
import type { Project } from "@/lib/room/types";
import { saveBrandKey, updateBrandKeyMeta, removeBrandKey } from "@/lib/room/brand-actions";
import { useRoom } from "../room-provider";
import { Alert, Bar, Btn, BudgetPanel, Card, Chip, Sheet } from "../ui";
import { BILLING_LABEL, GROUPS, PROVIDERS, WORKSPACE_CAP, costSplit, isMetered, providerOf, spendOf, usd, type BrandKeys, type OwnKey, type Provider, type ProviderId } from "./brand-keys";
import { KeyForm } from "./key-form";

const meterTone = (pct: number) => (pct >= 95 ? "bad" : pct >= 80 ? "warn" : "brand");
const noun = (p: Provider) => (p.kind === "grant" ? "access" : "key");
const caps = "font-mono text-code uppercase text-ink-500";

export function IntegrationsTab({
  project,
  keys,
  onSet,
  onDelete,
}: {
  project: Project;
  keys: BrandKeys;
  onSet: (providerId: ProviderId, key: OwnKey) => void;
  onDelete: (providerId: ProviderId) => void;
}) {
  const api = useRoom();
  const isAdmin = api.state.role === "admin";
  const [editing, setEditing] = useState<ProviderId | null>(null);
  const [removing, setRemoving] = useState<ProviderId | null>(null);

  /** Every key change lands in the brand's chronicle (without the key) and shows a toast. */
  const log = (text: string, toast = text) => {
    api.addChronicle(project.id, "settings", text);
    api.toast(toast);
  };

  const { own, workspace } = costSplit(project.id, keys);
  const wsPct = (workspace / WORKSPACE_CAP) * 100;
  const onOwn = PROVIDERS.filter((p) => keys[p.id]?.active).length;
  const edit = editing ? providerOf(editing) : null;
  const rem = removing ? providerOf(removing) : null;

  return (
    <div className="space-y-8">
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

      <div className="space-y-3">
        {isAdmin ? (
          <p className="max-w-chat text-pretty text-[14px] leading-[1.5] text-ink-500">
            Add a key per provider and {project.name} runs on its own account: the usage is billed to the brand and counted here. Without a key it uses the workspace key and is charged to the workspace. Search Console is the exception: it works only when the brand&apos;s owner grants access.
          </p>
        ) : (
          <Alert tone="info">Only an admin can add or change keys. You can see which providers run on a brand key and what each one cost.</Alert>
        )}
        <p className="font-mono text-[13px] text-ink-500">
          {PROVIDERS.length} providers · {onOwn} on {project.name}&apos;s own {onOwn === 1 ? "key" : "keys"} · {PROVIDERS.length - onOwn} on the workspace
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`grp-${g.id}`}>
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
            <h3 id={`grp-${g.id}`} className={caps}>{g.label}</h3>
            <p className="text-[13px] text-ink-500">{g.hint}</p>
          </div>
          <ul className="grid gap-6 md:grid-cols-2" aria-labelledby={`grp-${g.id}`}>
            {PROVIDERS.filter((p) => p.group === g.id).map((p) => (
              <li key={p.id} className="flex">
                <ProviderCard
                  project={project}
                  provider={p}
                  own={keys[p.id]}
                  isAdmin={isAdmin}
                  onAdd={() => setEditing(p.id)}
                  onTest={() => api.toast(`${p.name}: test passed (prototype)`)}
                  onToggle={(k) => {
                    const next = { ...k, active: !k.active };
                    onSet(p.id, next);
                    if (project.dbId) updateBrandKeyMeta(project.dbId, p.id, { active: next.active });
                    log(k.active ? `Own ${p.name} ${noun(p)} switched off — ${p.kind === "grant" ? "its checks are skipped" : "using the workspace key"}` : `Own ${p.name} ${noun(p)} switched on`);
                  }}
                  onRemove={() => setRemoving(p.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-[13px] leading-[1.5] text-ink-500">
        Not listed because they take no brand key: the database and sign-in (Supabase), hosting (Vercel) and file storage (Cloudflare R2) run on the workspace. Similarweb and Mention or Brand24 are held back until after the pilot.
      </p>
      <p className="text-[13px] leading-[1.5] text-ink-500">
        Keys are stored encrypted (AES-256-GCM) in the database. Only the last 4 characters are shown here; the full key is never returned to the client. Spend figures are sample data.
      </p>

      <Sheet open={edit !== null} onClose={() => setEditing(null)} title={edit ? `${edit.name} ${noun(edit)}` : "API key"}>
        {edit && (
          <KeyForm
            provider={edit}
            intro={edit.kind === "grant" ? `${project.name} gives you read access to its own Search Console data. Nothing is billed.` : `${project.name}'s ${edit.name} usage is billed to the account that owns this key.`}
            current={keys[edit.id]}
            onCancel={() => setEditing(null)}
            onSave={(key, fullKey) => {
              const replacing = !!keys[edit.id];
              onSet(edit.id, key);
              setEditing(null);
              if (project.dbId && fullKey) {
                saveBrandKey(project.dbId, edit.id, fullKey, key).catch(() => {/* toast already showed */});
              }
              log(replacing ? `Own ${edit.name} ${noun(edit)} replaced` : `Own ${edit.name} ${noun(edit)} added`, `${edit.name} ${noun(edit)} saved for ${project.name}`);
            }}
          />
        )}
      </Sheet>

      <Sheet open={rem !== null} onClose={() => setRemoving(null)} title={rem ? `Remove this ${noun(rem)}?` : "Remove this key?"}>
        {rem && (
          <div className="space-y-5 text-[15px]">
            <p className="leading-[1.6]">
              {rem.kind === "grant"
                ? `${project.name} no longer shares its Search Console data, so those checks are skipped until the owner grants access again.`
                : `${project.name} goes back to the workspace key for ${rem.name}. From then on its usage is charged to the workspace, not to the brand. You can add a key again at any time.`}
            </p>
            <div className="flex justify-end gap-3">
              <Btn variant="ghost" onClick={() => setRemoving(null)}>Cancel</Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  onDelete(rem.id);
                  setRemoving(null);
                  if (project.dbId) removeBrandKey(project.dbId, rem.id).catch(() => {/* silent */});
                  log(`Own ${rem.name} ${noun(rem)} removed${rem.kind === "grant" ? "" : " — back to the workspace key"}`);
                }}
              >
                Remove {noun(rem)}
              </Btn>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ProviderCard({
  project,
  provider: p,
  own: k,
  isAdmin,
  onAdd,
  onTest,
  onToggle,
  onRemove,
}: {
  project: Project;
  provider: Provider;
  own?: OwnKey;
  isAdmin: boolean;
  onAdd: () => void;
  onTest: () => void;
  onToggle: (k: OwnKey) => void;
  onRemove: () => void;
}) {
  const grant = p.kind === "grant";
  const metered = isMetered(p);
  const spend = spendOf(project.id, p.id);

  const status = !k
    ? { tone: "neutral" as const, text: grant ? "Not granted" : "Workspace key" }
    : k.active
      ? { tone: "ok" as const, text: grant ? "Access granted" : "Own key" }
      : { tone: "warn" as const, text: grant ? "Access paused" : "Own key off" };

  const note = !k
    ? grant
      ? "No access yet, so Search Console checks are skipped."
      : "Charged to the workspace key."
    : k.active
      ? grant
        ? `Reads ${isAdmin ? k.property : "the brand's property"} with the brand's own Google access.`
        : `Billed to ${project.name}'s own ${p.name} ${p.billing === "plan" ? "plan" : "account"}.`
      : grant
        ? "The access is paused, so Search Console checks are skipped."
        : "The own key is off, so this provider is charged to the workspace key.";

  return (
    <Card small className="flex w-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-40">
          <h4 className="font-title text-h3 text-ink-800">{p.name}</h4>
          <p className="mt-1 text-[14px] leading-[1.5] text-ink-500">{p.use}</p>
        </div>
        <Chip tone={status.tone}>{status.text}</Chip>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <dt className="label-caps text-ink-500">{grant ? "Access" : "Key"}</dt>
          <dd className="mt-1 truncate font-mono text-[14px] text-ink-800">
            {grant ? (k ? (isAdmin ? k.property : "Granted") : "Not granted") : k ? (isAdmin ? `••••••••${k.last4}` : "Brand key") : "Workspace"}
          </dd>
          {isAdmin && k?.login && <dd className="mt-0.5 truncate text-[13px] text-ink-500">Login {k.login}</dd>}
        </div>
        <div>
          <dt className="label-caps text-ink-500">{metered ? "Cost this month" : "Billing"}</dt>
          <dd className="mt-1 font-mono text-[14px] text-ink-800">
            {metered ? (
              <>
                {usd(spend)}
                {k?.active && <span className="text-ink-500"> / {usd(k.cap)}</span>}
              </>
            ) : (
              BILLING_LABEL[p.billing]
            )}
          </dd>
        </div>
      </dl>
      {metered && k?.active && (
        <div className="mt-3">
          <Bar value={spend} max={k.cap} tone={meterTone((spend / k.cap) * 100)} label={`${p.name} spend on ${project.name} against its cap`} />
        </div>
      )}
      <p className="mt-4 text-[13px] leading-[1.5] text-ink-500">{note}</p>

      {isAdmin && (
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {!k ? (
            <Btn size="xs" variant="secondary" onClick={onAdd}>
              <KeyRound className="size-4" aria-hidden /> {grant ? "Add access" : "Add own key"}
            </Btn>
          ) : (
            <>
              <Btn size="xs" variant="secondary" onClick={onAdd}>
                {grant ? "Change property" : "Replace key"}
              </Btn>
              <Btn size="xs" variant="secondary" onClick={onTest}>
                {grant ? "Test access" : "Test key"}
              </Btn>
              <Btn size="xs" variant="secondary" onClick={() => onToggle(k)}>
                {k.active ? (grant ? "Pause access" : "Turn key off") : grant ? "Resume access" : "Turn key on"}
              </Btn>
              <Btn size="xs" variant="danger" onClick={onRemove}>
                {grant ? "Remove access" : "Remove key"}
              </Btn>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
