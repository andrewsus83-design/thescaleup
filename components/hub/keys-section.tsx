import { CalendarDays, HardDrive } from "lucide-react";
import { Alert, Chip } from "@/components/brand/primitives";
import { KeyRow } from "@/components/hub/keys-panel";
import { GROUPS, fallsBack, providersFor, type GroupId } from "@/lib/hub/providers";
import { isEncryptionReady, secretStatus } from "@/lib/hub/secrets";

/** Keys for the workspace (brandId = null) or one brand, grouped by what they are for. Server component: reads only the last 4 characters. */
export async function KeysSection({ brandId, only }: { brandId: string | null; only?: GroupId[] }) {
  const scope = brandId ?? "workspace";
  const [own, workspace] = await Promise.all([secretStatus(brandId), brandId ? secretStatus(null) : Promise.resolve({})]);
  const ready = isEncryptionReady();
  const list = providersFor(brandId ? "brand" : "workspace");
  return (
    <div className="space-y-8">
      {!ready && (
        <Alert tone="warn" role="alert">
          Encryption is not set up on the server yet, so keys cannot be saved. Add <code className="font-mono">SECRETS_KEY_1</code> (see the PR notes).
        </Alert>
      )}
      {GROUPS.filter((g) => !only || only.includes(g.id)).map((g) => {
        const rows = list.filter((p) => p.group === g.id);
        const showGoogleSoon = Boolean(brandId) && g.id === "google";
        if (rows.length === 0 && !showGoogleSoon) return null;
        return (
          <section key={g.id} aria-labelledby={`grp-${g.id}`}>
            <h3 id={`grp-${g.id}`} className="font-title text-h4 text-ink-800">{g.label}</h3>
            <p className="mt-1 text-small text-ink-500">{g.hint}</p>
            <ul className="mt-2 divide-y divide-ink-100">
              {rows.map((p) => {
                const s = own[p.key];
                return (
                  <KeyRow
                    key={p.key}
                    scope={scope}
                    provider={p}
                    status={s ? { last4: s.last4, updatedAt: s.updated_at } : null}
                    inherited={!s && Boolean(brandId) && fallsBack(p) && Boolean((workspace as Record<string, unknown>)[p.key])}
                  />
                );
              })}
              {showGoogleSoon &&
                [
                  { name: "Google Drive", use: "Attach and read a brand's files", Icon: HardDrive },
                  { name: "Google Calendar", use: "Show and create events next to tasks", Icon: CalendarDays },
                ].map(({ name, use, Icon }) => (
                  <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-5">
                    <div className="flex items-center gap-3">
                      <Icon className="size-5 text-ink-400" aria-hidden />
                      <div>
                        <p className="text-body font-semibold text-ink-800">{name}</p>
                        <p className="text-small text-ink-500">{use}. Needs the sign-in with Google, which comes in a later release.</p>
                      </div>
                    </div>
                    <Chip tone="neutral">Coming next</Chip>
                  </li>
                ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
