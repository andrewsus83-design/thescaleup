"use client";

// The live profile card: fills as answers arrive, one status chip per field — answered, found on the website,
// unknown, or still missing. At the confirmation step every row can be edited in place.

import { useState } from "react";
import { Check, CircleDashed, Pencil, X } from "lucide-react";
import { checklist } from "@/lib/room/intake";
import type { FieldKey, IntakeState, Lang, Profile } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { Btn, Chip, errorCls, motion, textareaCls } from "../ui";

export const ROWS: { key: FieldKey; en: string; id: string }[] = [
  { key: "brand", en: "Brand", id: "Brand" },
  { key: "website", en: "Website", id: "Website" },
  { key: "handles", en: "Social handles", id: "Akun sosial" },
  { key: "who", en: "Who", id: "Siapa" },
  { key: "what", en: "What", id: "Apa" },
  { key: "when", en: "When", id: "Kapan" },
  { key: "where", en: "Where", id: "Di mana" },
  { key: "why", en: "Why", id: "Mengapa" },
];

export function valueOf(p: Profile, f: FieldKey): string | undefined {
  if (f === "handles") return p.noAccounts ? "No accounts" : p.handles?.length ? p.handles.join(" · ") : undefined;
  return p[f];
}

type Kind = "answered" | "website" | "unknown" | "missing";

export function fieldKind(state: IntakeState, f: FieldKey): Kind {
  const src = state.sources[f];
  return src === "unknown" ? "unknown" : !valueOf(state.profile, f) ? "missing" : src === "website" ? "website" : "answered";
}

export function StatusChip({ kind, lang }: { kind: Kind; lang: Lang }) {
  const t = (en: string, id: string) => (lang === "id" ? id : en);
  switch (kind) {
    case "answered":
      return <Chip tone="ok">{t("Answered", "Terjawab")}</Chip>;
    case "website":
      return <Chip tone="brand">{t("Found on website", "Ditemukan di website")}</Chip>;
    case "unknown":
      return <Chip tone="warn">{t("Unknown", "Tidak tahu")}</Chip>;
    default:
      return <Chip tone="neutral">{t("Still missing", "Masih kosong")}</Chip>;
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
    <div className="rounded-bubble border border-hairline bg-paper-0 p-6">
      <h2 className="font-title text-h3 text-ink-800">{lang === "id" ? "Kartu profil" : "Profile card"}</h2>
      <dl className="mt-5 space-y-5">
        {ROWS.map((r) => {
          const val = valueOf(state.profile, r.key);
          const kind = fieldKind(state, r.key);
          const label = lang === "id" ? r.id : r.en;
          return (
            <div key={r.key}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <dt className="label-caps text-ink-500">{label}</dt>
                <div className="flex items-center gap-1">
                  <StatusChip kind={kind} lang={lang} />
                  {editable && editing !== r.key && (
                    <button
                      type="button"
                      aria-label={`${lang === "id" ? "Ubah" : "Edit"} ${label}`}
                      onClick={() => begin(r.key)}
                      className={cn("hit-44 inline-flex size-8 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 hover:text-ink-800", motion)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
              {editing === r.key ? (
                <div className="mt-3">
                  <textarea
                    aria-label={label}
                    aria-invalid={!!error}
                    value={draft}
                    rows={r.key === "who" || r.key === "what" || r.key === "why" ? 3 : 1}
                    onChange={(e) => setDraft(e.target.value)}
                    className={textareaCls}
                    autoFocus
                  />
                  {error && (
                    <p role="alert" className={errorCls}>
                      {error}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Btn size="xs" variant="primary" onClick={save}>
                      <Check className="size-4" aria-hidden /> {lang === "id" ? "Simpan" : "Save"}
                    </Btn>
                    <Btn size="xs" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="size-4" aria-hidden /> {lang === "id" ? "Batal" : "Cancel"}
                    </Btn>
                  </div>
                </div>
              ) : (
                <dd className={cn("mt-2 text-[15px] leading-[1.5] [overflow-wrap:anywhere]", val ? "text-ink-800" : "text-ink-500")}>{val ?? "—"}</dd>
              )}
            </div>
          );
        })}
      </dl>

      <div className="mt-6 rounded-field bg-paper-100 p-4">
        <p className="text-[13px] font-semibold text-ink-800">{lang === "id" ? "Sebelum saya minta konfirmasi" : "Before I ask you to confirm"}</p>
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2 text-[13px] leading-[1.5]">
              {c.ok ? <Check className="mt-0.5 size-4 shrink-0 text-success-ink" aria-label="OK" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-500" aria-label="Not yet" />}
              <span>
                <span className="font-semibold text-ink-800">{c.label}</span> <span className="text-ink-500">· {c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
