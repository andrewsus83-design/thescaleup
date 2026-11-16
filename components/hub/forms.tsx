"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls } from "@/components/brand/styles";
import { createBrand, createInvite, type FormState } from "@/lib/hub/actions";
import { ROLE_LABEL, type BrandRole } from "@/lib/hub/rules";
import { slugify } from "@/lib/hub/slug";

export function NewBrandForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createBrand, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      <div>
        <label htmlFor="brand-name" className={labelCls}>
          Brand name
        </label>
        <input
          id="brand-name"
          name="name"
          required
          maxLength={80}
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setSlug(slugify(e.target.value));
          }}
          placeholder="Kopi Nusantara"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="brand-slug" className={labelCls}>
          Address
        </label>
        <input
          id="brand-slug"
          name="slug"
          required
          minLength={3}
          maxLength={40}
          value={slug}
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          placeholder="kopi-nusantara"
          className={inputCls}
        />
        <p className="mt-2 text-caption text-ink-500">Lowercase letters, numbers and hyphens. It becomes the brand&apos;s own subdomain and cannot be changed by the brand.</p>
      </div>
      <div>
        <label htmlFor="brand-site" className={labelCls}>
          Website <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input id="brand-site" name="website" inputMode="url" placeholder="kopinusantara.com" className={inputCls} />
      </div>
      <Btn type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-label="Creating" /> : "Create brand"}
      </Btn>
    </form>
  );
}

export function InviteForm({ brandId, roles }: { brandId: string; roles: BrandRole[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link is visible in the field, so it can still be copied by hand */
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert tone={state.emailed ? "ok" : "warn"} role="status">
          {state.message}
        </Alert>
      )}
      {state.inviteUrl && (
        <div className="flex gap-2">
          <input readOnly value={state.inviteUrl} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} className={`${inputCls} font-mono text-small`} />
          <Btn variant="secondary" size="md" onClick={() => copy(state.inviteUrl!)} aria-label="Copy invitation link">
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </Btn>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div>
          <label htmlFor="invite-email" className={labelCls}>
            Email
          </label>
          <input id="invite-email" name="email" type="email" required autoComplete="off" placeholder="name@company.com" className={inputCls} />
        </div>
        <div>
          <label htmlFor="invite-role" className={labelCls}>
            Role
          </label>
          <select id="invite-role" name="role" defaultValue={roles[0]} className={inputCls}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Btn type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-label="Inviting" /> : "Send invitation"}
      </Btn>
    </form>
  );
}
