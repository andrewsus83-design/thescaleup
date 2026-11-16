import { RoleAccessForm } from "@/components/hub/access-editor";
import { loadOverrides } from "@/lib/hub/access";
import { DEFAULTS, editableRoles, resolveAccess } from "@/lib/hub/permissions";
import type { Actor } from "@/lib/hub/rules";

/** The access form for every role this person may change. Server component: reads the stored changes. */
export async function AccessCards({ brandId, actor }: { brandId: string; actor: Actor }) {
  const roles = editableRoles(actor);
  const overrides = await Promise.all(roles.map((r) => loadOverrides(brandId, r)));
  return (
    <>
      {roles.map((role, i) => (
        <RoleAccessForm key={role} brandId={brandId} role={role} current={resolveAccess(role, overrides[i])} defaults={DEFAULTS[role]} />
      ))}
    </>
  );
}
