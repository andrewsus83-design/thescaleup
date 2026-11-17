// Pure rules for the public lead form: what a manager may set, and what a visitor's answer must look like. No I/O.

import { EMAIL, oneLine, parseTags } from "./model";
import { pickEmail, pickPhone } from "./import";

export const FORM_LIMITS = { perBrand: 20, name: 80, title: 120, intro: 600, thanks: 300, consent: 300, source: 60, message: 1000, person: 120, company: 120 } as const;
export const MODES = ["off", "optional", "required"] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (v: unknown): v is Mode => typeof v === "string" && (MODES as readonly string[]).includes(v);
export const TOKEN = /^[a-z0-9]{12}$/;
export const DEFAULT_THANKS = "Thank you. We will be in touch soon.";
export const DEFAULT_CONSENT = "I agree to be contacted about this.";

export type FormSettings = {
  name: string;
  title: string;
  intro: string;
  thanks: string;
  email_mode: Mode;
  phone_mode: Mode;
  ask_company: boolean;
  ask_message: boolean;
  consent_text: string;
  tags: string[];
  source: string;
  enabled: boolean;
};
export type LeadForm = FormSettings & { id: string; brand_id: string; token: string; created_by: string | null; created_at: string };

const yes = (v: string) => v === "1" || v === "on" || v === "true";

/** Reads the form editor. A blank title uses the name, a blank source uses the name. */
export function parseFormSettings(get: (k: string) => string): { ok: true; value: FormSettings } | { ok: false; error: string } {
  const name = oneLine(get("name"), FORM_LIMITS.name);
  if (!name) return { ok: false, error: "Give the form a name, so you can tell your forms apart." };
  const email_mode = get("email_mode");
  const phone_mode = get("phone_mode");
  if (!isMode(email_mode) || !isMode(phone_mode)) return { ok: false, error: "Choose whether to ask for email and phone." };
  if (email_mode === "off" && phone_mode === "off") return { ok: false, error: "Ask for an email or a phone number, or the form cannot reach anyone." };
  const multi = (s: string, max: number) => s.replace(/\r/g, "").replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]+/g, " ").trim().slice(0, max);
  return {
    ok: true,
    value: {
      name,
      title: oneLine(get("title"), FORM_LIMITS.title),
      intro: multi(get("intro"), FORM_LIMITS.intro),
      thanks: oneLine(get("thanks"), FORM_LIMITS.thanks),
      email_mode,
      phone_mode,
      ask_company: yes(get("ask_company")),
      ask_message: yes(get("ask_message")),
      consent_text: oneLine(get("consent_text"), FORM_LIMITS.consent),
      tags: parseTags(get("tags")).slice(0, 10),
      source: oneLine(get("source"), FORM_LIMITS.source),
      enabled: get("enabled") !== "0",
    },
  };
}

export type Answer = { name: string; company: string; email: string; phone: string; message: string; consent: boolean };

/** Reads what a visitor typed. Every message says what to fix, in the visitor's words. */
export function parseAnswer(cfg: Pick<FormSettings, "email_mode" | "phone_mode" | "ask_company" | "ask_message" | "consent_text">, get: (k: string) => string): { ok: true; value: Answer } | { ok: false; error: string } {
  const name = oneLine(get("name"), FORM_LIMITS.person);
  if (!name) return { ok: false, error: "Enter your name." };

  let email = "";
  if (cfg.email_mode !== "off") {
    const raw = get("email").trim();
    if (raw) {
      email = pickEmail(raw);
      if (!email || !EMAIL.test(email)) return { ok: false, error: "That email address does not look right." };
    } else if (cfg.email_mode === "required") return { ok: false, error: "Enter your email address." };
  }
  let phone = "";
  if (cfg.phone_mode !== "off") {
    const raw = get("phone").trim();
    if (raw) {
      phone = pickPhone(raw);
      if (!phone) return { ok: false, error: "That phone number does not look right. Use digits, spaces and +." };
    } else if (cfg.phone_mode === "required") return { ok: false, error: "Enter your phone number." };
  }
  if (!email && !phone) return { ok: false, error: cfg.email_mode !== "off" && cfg.phone_mode !== "off" ? "Enter your email or your phone number." : cfg.email_mode !== "off" ? "Enter your email address." : "Enter your phone number." };

  const company = cfg.ask_company ? oneLine(get("company"), FORM_LIMITS.company) : "";
  const message = cfg.ask_message ? get("message").replace(/\r/g, "").replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]+/g, " ").trim().slice(0, FORM_LIMITS.message) : "";
  const consent = yes(get("consent"));
  if (cfg.consent_text && !consent) return { ok: false, error: "Tick the box to continue." };
  return { ok: true, value: { name, company, email, phone, message, consent } };
}

/** The note a new lead starts with: where they came from, what they wrote, and what they agreed to. */
export function newLeadNote(form: Pick<FormSettings, "name" | "consent_text">, a: Pick<Answer, "message" | "consent">): string {
  const parts = [`Came in through the form “${form.name}”.`];
  if (a.message) parts.push(a.message);
  if (form.consent_text && a.consent) parts.push(`Ticked: “${form.consent_text}”`);
  return parts.join("\n\n");
}

/** The note for someone who was already in the CRM. Their details are not changed by what a stranger typed into a public form. */
export function repeatNote(form: Pick<FormSettings, "name">, a: Pick<Answer, "message" | "name" | "phone" | "email">): string {
  const parts = [`Filled in the form “${form.name}” again.`];
  if (a.message) parts.push(a.message);
  return parts.join("\n\n");
}

export const formPath = (token: string) => `/f/${token}`;
