"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Btn } from "@/components/brand/primitives";
import { inputCls } from "@/components/brand/styles";
import { renameBrand, type FormState } from "@/lib/hub/actions";

/** The brand's name as a field the founder and the agency can change. The address stays the same, so no link breaks. */
export function BrandNameForm({ brandId, name }: { brandId: string; name: string }) {
  const [value, setValue] = useState(name);
  const [state, action, pending] = useActionState<FormState, FormData>(renameBrand, {});
  const changed = value.trim() !== name && value.trim() !== "";
  return (
    <form action={action}>
      <input type="hidden" name="brandId" value={brandId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} required autoComplete="off" aria-label="Brand name" aria-describedby="brand-name-note" className={inputCls} />
        <Btn type="submit" variant="secondary" size="md" disabled={pending || !changed} className="shrink-0">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save name
        </Btn>
      </div>
      <p id="brand-name-note" aria-live="polite" className={`mt-2 text-caption ${state.error ? "text-danger" : "text-ink-500"}`}>
        {state.error ?? state.message ?? "Changing the name keeps the address, so links and connections keep working."}
      </p>
    </form>
  );
}
