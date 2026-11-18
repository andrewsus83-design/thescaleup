"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls } from "@/components/brand/styles";
import { FUNCTIONS, FUNCTION_INFO, LEVELS, LEVEL_LABEL, type Access, type ConfigurableRole } from "@/lib/hub/permissions";
import { resetPermissions, savePermissions } from "@/lib/hub/permission-actions";
import type { FormState } from "@/lib/hub/actions";
import { ROLE_LABEL } from "@/lib/hub/rules";

/** One role's access: a level per function. Saved together; "Back to defaults" removes the changes. */
export function RoleAccessForm({ brandId, role, current, defaults }: { brandId: string; role: ConfigurableRole; current: Access; defaults: Access }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePermissions, {});
  const changed = FUNCTIONS.some((f) => current[f] !== defaults[f]);
  return (
    // The key remounts the form when the saved values change (after Save or Back to defaults), so the selects show what is stored.
    <form key={JSON.stringify(current)} action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="role" value={role} />
      <h3 className="font-title text-body font-bold text-ink-800">{ROLE_LABEL[role]}</h3>
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert tone="ok" role="status">
          {state.message}
        </Alert>
      )}
      {/* Salary and payroll is not built yet, so its row is hidden. Its stored level is sent back unchanged. */}
      <input type="hidden" name="fn:payroll" value={current.payroll} />
      <ul className="divide-y divide-ink-100">
        {FUNCTIONS.filter((f) => f !== "payroll").map((f) => {
          const id = `acc-${role}-${f}`;
          return (
            <li key={f} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <label htmlFor={id} className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-ink-800">{FUNCTION_INFO[f].label}</span>
                <span className="block text-small text-ink-500">{FUNCTION_INFO[f].hint}</span>
              </label>
              <select id={id} name={`fn:${f}`} defaultValue={current[f]} className={`${inputCls} w-40 shrink-0`}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                    {l === defaults[f] ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-label="Saving" /> : "Save access"}
        </Btn>
        {changed && (
          <Btn type="submit" variant="ghost" size="md" formAction={resetPermissions} disabled={pending}>
            Back to defaults
          </Btn>
        )}
      </div>
    </form>
  );
}
