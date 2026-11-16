import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Card, Chip } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { InviteForm } from "@/components/hub/forms";
import { KeysSection } from "@/components/hub/keys-section";
import { removeMember, revokeInvite } from "@/lib/hub/actions";
import { canInvite, canManageTeam, canRemove, invitableRoles, isBrandRole, ROLE_LABEL, type BrandRole } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

type Person = { userId: string; email: string; role: BrandRole };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireBrand(slug);
  const manage = canManageTeam(actor);

  let people: Person[] = [];
  let invites: { id: string; email: string; role: BrandRole; expires_at: string }[] = [];
  if (manage) {
    const admin = createSupabaseAdminClient();
    const [{ data: members }, { data: open }] = await Promise.all([
      admin.from("brand_members").select("user_id, role").eq("brand_id", brand.id).order("created_at"),
      admin.from("brand_invites").select("id, email, role, expires_at").eq("brand_id", brand.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at"),
    ]);
    people = await Promise.all(
      (members ?? [])
        .filter((m) => isBrandRole(m.role))
        .map(async (m) => {
          const { data } = await admin.auth.admin.getUserById(m.user_id);
          return { userId: m.user_id, email: data.user?.email ?? "unknown", role: m.role as BrandRole };
        }),
    );
    invites = (open ?? []).filter((i) => isBrandRole(i.role)) as typeof invites;
  }

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="font-title text-h3 text-ink-800">Brand</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-body sm:grid-cols-[8rem_1fr]">
          <dt className="text-ink-500">Name</dt>
          <dd className="text-ink-800">{brand.name}</dd>
          <dt className="text-ink-500">Address</dt>
          <dd className="font-mono text-small text-ink-800">{brand.slug}</dd>
          <dt className="text-ink-500">Website</dt>
          <dd className="truncate text-ink-800">{brand.website ?? "—"}</dd>
          <dt className="text-ink-500">Your role</dt>
          <dd>
            <Chip tone="brand">{actor === "owner" ? "Agency owner" : ROLE_LABEL[actor]}</Chip>
          </dd>
        </dl>
      </Card>

      {manage && (
        <Card>
          <h2 className="font-title text-h3 text-ink-800">Keys and connections</h2>
          <p className="mt-2 text-body text-ink-500">This brand&apos;s own keys. AI keys you leave empty use the agency&apos;s default. Connections such as Zernio belong to this brand only. Keys are encrypted and cannot be read back.</p>
          <div className="mt-4">
            <KeysSection brandId={brand.id} />
          </div>
        </Card>
      )}

      {manage ? (
        <Card>
          <h2 className="font-title text-h3 text-ink-800">Team</h2>
          <p className="mt-2 text-body text-ink-500">
            {actor === "owner" ? "Invite the founder first. The founder then invites their own ops and viewers." : "Invite your ops and viewers. They sign in with the email you invite."}
          </p>

          <ul className="mt-6 divide-y divide-ink-100">
            {people.map((p) => (
              <li key={p.userId} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-body text-ink-800">{p.email}</p>
                  <p className="text-small text-ink-500">{ROLE_LABEL[p.role]}{p.userId === user.id ? " (you)" : ""}</p>
                </div>
                {canRemove(actor, p.role, p.userId === user.id) && (
                  <form action={removeMember}>
                    <input type="hidden" name="brandId" value={brand.id} />
                    <input type="hidden" name="userId" value={p.userId} />
                    <button type="submit" className={btnCls("ghost", "sm")} aria-label={`Remove ${p.email}`}>
                      <Trash2 className="size-4" aria-hidden />
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-body text-ink-800">{i.email}</p>
                  <p className="text-small text-ink-500">
                    {ROLE_LABEL[i.role]} · <Chip tone="warn">Invited</Chip>
                  </p>
                </div>
                {canInvite(actor, i.role) && (
                  <form action={revokeInvite}>
                    <input type="hidden" name="inviteId" value={i.id} />
                    <button type="submit" className={btnCls("ghost", "sm")} aria-label={`Cancel invitation for ${i.email}`}>
                      Cancel
                    </button>
                  </form>
                )}
              </li>
            ))}
            {people.length === 0 && invites.length === 0 && <li className="py-3 text-body text-ink-500">No one yet.</li>}
          </ul>

          <div className="mt-6 border-t border-ink-100 pt-6">
            <h3 className="mb-4 font-title text-body font-bold text-ink-800">Invite someone</h3>
            <InviteForm brandId={brand.id} roles={invitableRoles(actor)} />
          </div>
        </Card>
      ) : (
        <p className="text-small text-ink-500">Team settings are managed by the founder.</p>
      )}
    </div>
  );
}
