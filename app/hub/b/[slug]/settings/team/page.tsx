import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, Chip } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { AccessCards } from "@/components/hub/access-cards";
import { InviteForm } from "@/components/hub/forms";
import { SettingsShell } from "@/components/hub/settings-shell";
import { removeMember, revokeInvite } from "@/lib/hub/actions";
import { resetAuthenticator } from "@/lib/hub/mfa-actions";
import { canInvite, canManageTeam, canRemove, invitableRoles, isBrandRole, ROLE_LABEL, type BrandRole } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

type Person = { userId: string; email: string; role: BrandRole; mfa: boolean };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();

  const admin = createSupabaseAdminClient();
  const [{ data: members }, { data: open }] = await Promise.all([
    admin.from("brand_members").select("user_id, role").eq("brand_id", brand.id).order("created_at"),
    admin.from("brand_invites").select("id, email, role, expires_at").eq("brand_id", brand.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at"),
  ]);
  const people: Person[] = await Promise.all(
    (members ?? [])
      .filter((m) => isBrandRole(m.role))
      .map(async (m) => {
        const [{ data }, { data: factors }] = await Promise.all([admin.auth.admin.getUserById(m.user_id), admin.auth.admin.mfa.listFactors({ userId: m.user_id })]);
        return { userId: m.user_id, email: data.user?.email ?? "unknown", role: m.role as BrandRole, mfa: Boolean(factors?.factors.some((f) => f.factor_type === "totp" && f.status === "verified")) };
      }),
  );
  const invites = (open ?? []).filter((i) => isBrandRole(i.role)) as { id: string; email: string; role: BrandRole; expires_at: string }[];

  return (
    <SettingsShell
      slug={slug}
      title="Team"
      description={actor === "owner" ? "Invite the founder first. The founder then invites their own ops and viewers." : "Invite your ops and viewers. They sign in with the email you invite."}
    >
      <Card>
        <ul className="divide-y divide-ink-100">
          {people.map((p) => (
            <li key={p.userId} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-body text-ink-800">{p.email}</p>
                <p className="text-small text-ink-500">
                  {ROLE_LABEL[p.role]}
                  {p.userId === user.id ? " (you)" : ""} · {p.mfa ? "Authenticator on" : "No authenticator yet"}
                </p>
              </div>
              {p.mfa && canRemove(actor, p.role, p.userId === user.id) && (
                <details className="shrink-0">
                  <summary className={btnCls("ghost", "sm", "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>Reset authenticator</summary>
                  <form action={resetAuthenticator} className="mt-2 space-y-2 rounded-field bg-paper-100 p-3">
                    <input type="hidden" name="brandId" value={brand.id} />
                    <input type="hidden" name="userId" value={p.userId} />
                    <p className="text-small text-ink-800">For a lost phone. They set up a new one the next time they open Mail.</p>
                    <button type="submit" className={btnCls("danger", "xs")}>
                      Reset for {p.email.split("@")[0]}
                    </button>
                  </form>
                </details>
              )}
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
          <h2 className="mb-4 font-title text-body font-bold text-ink-800">Invite someone</h2>
          <InviteForm brandId={brand.id} roles={invitableRoles(actor)} />
        </div>
      </Card>

      <Card>
        <h2 className="font-title text-h3 text-ink-800">Roles and access</h2>
        <p className="mt-2 text-body text-ink-500">
          Choose what each role can open and change, per function. The founder and the agency always have full access.
          {actor === "founder" && " Access for agency staff is set by the agency."}
        </p>
        <div className="mt-6 space-y-8">
          <AccessCards brandId={brand.id} actor={actor} />
        </div>
      </Card>
    </SettingsShell>
  );
}
