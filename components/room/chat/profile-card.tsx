"use client";

// The live profile card: fills as answers arrive, one chip per field — answered, found on the website,
// unknown, or still missing. At the confirmation step every row can be edited in place.

import { useState } from "react";
import { Check, CircleDashed, CircleHelp, Globe, Pencil, X } from "lucide-react";
import { checklist } from "@/lib/room/intake";
import type { FieldKey, IntakeState, Lang, Profile } from "@/lib/room/types";
import { Btn, Chip, inputCls } from "../ui";

const ROWS: { key: FieldKey; en: string; id: string }[] = [
  { key: "brand", en: "Brand", id: "Brand" },
  { key: "website", en: "Website", id: "Website" },
  { key: "handles", en: "Social handles", id: "Akun sosial" },
  { key: "who", en: "Who", id: "Siapa" },
  { key: "what", en: "What", id: "Apa" },
  { key: "when", en: "When", id: "Kapan" },
  { key: "where", en: "Where", id: "Di mana" },
  { key: "why", en: "Why", id: "Mengapa" },
];

function valueOf(p: Profile, f: FieldKey): string | undefined {
  if (f === "handles") return p.noAccounts ? "No accounts" : p.handles?.length ? p.handles.join(" · ") : undefined;
  return p[f];
}

function StatusChip({ kind, lang }: { kind: "answered" | "website" | "unknown" | "missing"; lang: Lang }) {
  const t = (en: string, id: string) => (lang === "id" ? id : en);
  switch (kind) {
    case "answered":
      return <Chip tone="good" icon={<Check className="h-3 w-3" aria-hidden />}>{t("Answered", "Terjawab")}</Chip>;
    case "website":
      return <Chip tone="info" icon={<Globe className="h-3 w-3" aria-hidden />}>{t("Found on website", "Ditemukan di website")}</Chip>;
    case "unknown":
      return <Chip tone="warn" icon={<CircleHelp className="h-3 w-3" aria-hidden />}>{t("Unknown", "Tidak tahu")}</Chip>;
    default:
      return <Chip tone="neutral" icon={<CircleDashed className="h-3 w-3" aria-hidden />}>{t("Still missing", "Masih kosong")}</Chip>;
  }
}

export function ProfileCard({
  state,
  lang,
  editable,
  onEdit,
}: {
  state: IntakeState;
  lang: Lang;
  editable?: boolean;
  /** Returns an error message to show under the field, or undefined when the edit was accepted. */
  onEdit?: (field: FieldKey, value: string) => string | undefined;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | undefined>();
  const checks = checklist(state, lang);

  const begin = (f: FieldKey) => {
    setEditing(f);
    setDraft(valueOf(state.profile, f) === "No accounts" ? "no accounts" : valueOf(state.profile, f)?.replace(/ · /g, ", ") ?? "");
    setError(undefined);
  };
  const save = () => {
    if (!editing) return;
    const err = onEdit?.(editing, draft);
    if (err) setError(err);
    else setEditing(null);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card/50 p-4">
      <h2 className="font-display text-base font-bold">{lang === "id" ? "Kartu profil" : "Profile card"}</h2>
      <dl className="mt-3 divide-y divide-white/8">
        {ROWS.map((r) => {
          const val = valueOf(state.profile, r.key);
          const src = state.sources[r.key];
          const kind = src === "unknown" ? "unknown" : !val ? "missing" : src === "website" ? "website" : "answered";
          const label = lang === "id" ? r.id : r.en;
          return (
            <div key={r.key} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</dt>
                <div className="flex items-center gap-1.5">
                  <StatusChip kind={kind} lang={lang} />
                  {editable && editing !== r.key && (
                    <button
                      type="button"
                      aria-label={`${lang === "id" ? "Ubah" : "Edit"} ${label}`}
                      onClick={() => begin(r.key)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 hover:text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
              {editing === r.key ? (
                <div className="mt-2">
                  <textarea
                    aria-label={label}
                    value={draft}
                    rows={r.key === "who" || r.key === "what" || r.key === "why" ? 3 : 1}
                    onChange={(e) => setDraft(e.target.value)}
                    className={inputCls}
                    autoFocus
                  />
                  {error && (
                    <p role="alert" className="mt-1.5 text-xs text-bad">
                      {error}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Btn size="sm" variant="primary" onClick={save}>
                      <Check className="h-3.5 w-3.5" aria-hidden /> {lang === "id" ? "Simpan" : "Save"}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-3.5 w-3.5" aria-hidden /> {lang === "id" ? "Batal" : "Cancel"}
                    </Btn>
                  </div>
                </div>
              ) : (
                <dd className={val ? "mt-1 text-sm text-slate-100" : "mt-1 text-sm text-slate-400"}>{val ?? "—"}</dd>
              )}
            </div>
          );
        })}
      </dl>

      <div className="mt-3 rounded-xl border border-white/8 bg-ink/30 p-3">
        <p className="text-xs font-semibold text-slate-300">{lang === "id" ? "Sebelum saya minta konfirmasi" : "Before I ask you to confirm"}</p>
        <ul className="mt-2 space-y-1.5">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-xs">
              {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" aria-label="OK" /> : <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Not yet" />}
              <span>
                <span className="font-medium text-slate-100">{c.label}</span> <span className="text-slate-400">· {c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
