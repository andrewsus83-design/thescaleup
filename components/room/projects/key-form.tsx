"use client";

// The form behind "Add own key" (Project → Integrations) and "Add key" (Setting → API keys). Prototype: the full key is
// discarded the moment the sheet closes (this component mounts only while it is open), only its last 4 characters are kept.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Btn, errorCls, inputCls, labelCls } from "../ui";
import { isMetered, type OwnKey, type Provider } from "./brand-keys";

export function KeyForm({ provider, intro, current, onSave, onCancel }: { provider: Provider; intro: string; current?: OwnKey; onSave: (k: OwnKey, secret?: string) => void; onCancel: () => void }) {
  const grant = provider.kind === "grant";
  const metered = isMetered(provider);
  const [secret, setSecret] = useState("");
  const [login, setLogin] = useState(current?.login ?? "");
  const [property, setProperty] = useState(current?.property ?? "");
  const [cap, setCap] = useState(String(current?.cap || 20));
  const [errs, setErrs] = useState<{ key?: string; login?: string; property?: string; cap?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errs = {};
    if (grant) {
      if (property.trim().length < 4) next.property = "Enter the Search Console property, for example sc-domain:brand.com.";
      setErrs(next);
      if (next.property) return;
      onSave({ last4: "", cap: 0, active: true, property: property.trim() });
      return;
    }
    const key = secret.trim();
    const amount = Number(cap.replace(",", "."));
    if (provider.login && login.trim().length < 3) next.login = "Enter the login of the account.";
    if (key.length < 12) next.key = "That looks too short. Paste the whole key from the provider's dashboard.";
    if (metered && (!Number.isFinite(amount) || amount <= 0)) next.cap = "Enter a monthly cap in USD, for example 25.";
    setErrs(next);
    if (Object.keys(next).length) return;
    onSave({ last4: key.slice(-4), cap: metered ? amount : 0, active: true, ...(provider.login ? { login: login.trim() } : {}) }, key);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5 text-[15px]">
      <p className="leading-[1.6] text-ink-500">{intro}</p>

      {grant ? (
        <div>
          <label htmlFor="key-property" className={labelCls}>Search Console property</label>
          <input
            id="key-property"
            value={property}
            onChange={(e) => setProperty(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="sc-domain:brand.com"
            className={cn(inputCls, "font-mono")}
            aria-invalid={!!errs.property}
            aria-describedby={errs.property ? "key-property-err key-property-hint" : "key-property-hint"}
          />
          {errs.property && <p id="key-property-err" role="alert" className={errorCls}>{errs.property}</p>}
          <p id="key-property-hint" className="mt-2 text-[13px] leading-[1.5] text-ink-500">
            Access comes from the brand&apos;s own Google account, never from a pasted password. In the product the owner signs in with Google and the token is kept encrypted in the vault.
          </p>
        </div>
      ) : (
        <>
          {provider.login && (
            <div>
              <label htmlFor="key-login" className={labelCls}>{provider.login}</label>
              <input
                id="key-login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className={inputCls}
                aria-invalid={!!errs.login}
                aria-describedby={errs.login ? "key-login-err" : undefined}
              />
              {errs.login && <p id="key-login-err" role="alert" className={errorCls}>{errs.login}</p>}
            </div>
          )}
          <div>
            <label htmlFor="brand-key" className={labelCls}>{provider.login ? "Password or API key" : "API key"}</label>
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
              placeholder={provider.hint ? `Paste the key · ${provider.hint}` : "Paste the key"}
              className={cn(inputCls, "font-mono")}
              aria-invalid={!!errs.key}
              aria-describedby={errs.key ? "brand-key-err brand-key-hint" : "brand-key-hint"}
            />
            {errs.key && <p id="brand-key-err" role="alert" className={errorCls}>{errs.key}</p>}
            <p id="brand-key-hint" className="mt-2 text-[13px] leading-[1.5] text-ink-500">It goes to the vault and is never shown again — only its last 4 characters.</p>
          </div>
          {metered ? (
            <div>
              <label htmlFor="brand-cap" className={labelCls}>Monthly cap (USD)</label>
              <input id="brand-cap" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className={cn(inputCls, "font-mono")} aria-invalid={!!errs.cap} aria-describedby={errs.cap ? "brand-cap-err" : undefined} />
              {errs.cap && <p id="brand-cap-err" role="alert" className={errorCls}>{errs.cap}</p>}
            </div>
          ) : (
            <p className="text-[13px] leading-[1.5] text-ink-500">
              {provider.billing === "plan" ? `${provider.name} bills a flat plan, so there is no per-call cap to set.` : `${provider.name} has a free tier, so there is no cap to set.`}
            </p>
          )}
        </>
      )}

      <div className="flex justify-end gap-3">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn type="submit" variant="primary">{grant ? "Save access" : "Save key"}</Btn>
      </div>
    </form>
  );
}
