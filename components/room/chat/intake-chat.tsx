"use client";

// The guided intake for a new brand: one question at a time, the website read, only the gaps asked, a live
// profile card, then an explicit "Create this brand?" confirmation. Nothing exists in Project until Create.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Save } from "lucide-react";
import { answer, detectLang, editField, MAX_QUESTIONS, canCreate, question, readingNote, toProject, tr } from "@/lib/room/intake";
import { createBrand } from "@/lib/room/brand-actions";
import type { FieldKey, Lang, MessageAction } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Btn, Chip, chatX } from "../ui";
import { Composer } from "./composer";
import { MessageView, Typing, type ActionChoice } from "./messages";
import { ProfileCard, ROWS, StatusChip, fieldKind, valueOf } from "./profile-card";

export function IntakeChat() {
  const api = useRoom();
  const { state, uid } = api;
  const s = state.intake;
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state.intakeLog.length, busy, s?.step]);

  if (!s) return null;

  const say = (text: string, action?: MessageAction) => api.logIntake({ id: uid(), role: "assistant", text, action });

  const submit = (text: string) => {
    const l = detectLang(text, lang);
    setLang(l);
    api.logIntake({ id: uid(), role: "user", text });
    const r = answer(s, text, state.projects, l);
    if (r.error) {
      say(r.error, r.conflict ? { type: "open", projectId: r.conflict.id, name: r.conflict.name } : undefined);
      return;
    }
    api.setIntake(r.state);
    if (r.justRead) {
      // a short beat while the website and socials are read, then only the gaps are asked
      setBusy(true);
      timers.current.push(
        window.setTimeout(() => {
          say(readingNote(r.state, l));
          say(question(r.state, l));
          setBusy(false);
        }, 1100),
      );
    } else say(question(r.state, l));
  };

  const edit = (f: FieldKey, v: string): string | undefined => {
    const r = editField(s, f, v, state.projects, lang);
    if (r.error) return r.error;
    api.setIntake(r.state);
    return undefined;
  };

  const create = async () => {
    const p = toProject(s, state.projects, "active");
    // Persist to DB (fire-and-forget on the client; the server action handles errors gracefully).
    // We patch dbId into the project once the DB returns the UUID.
    createBrand(p).then((dbId) => {
      if (dbId) api.saveProject({ ...p, dbId });
    });
    api.createProject(p, {
      id: uid(),
      role: "assistant",
      text: tr(
        lang,
        `"${p.name}" is created and this chat continues inside it. Next: an admin approves the positioning line, the profile is locked, and then the first audit can run. Until then I can only help complete and lock the profile.`,
        `"${p.name}" sudah dibuat dan chat ini berlanjut di dalamnya. Berikutnya: admin menyetujui kalimat positioning, profil dikunci, lalu audit pertama bisa dijalankan. Sampai saat itu saya hanya membantu melengkapi dan mengunci profil.`,
      ),
      used: [{ kind: "profile", label: "Profile (draft)" }],
    });
    api.toast(`"${p.name}" created`);
  };

  const leave = () => {
    if (s.profile.brand) {
      api.saveProject(toProject(s, state.projects, "draft"));
      api.toast("Draft saved — resume it from the start screen");
    }
    api.setIntake(null);
  };

  const onAction = (m: { action?: MessageAction }, c: ActionChoice) => {
    if (m.action?.type === "open" && c === "open") {
      api.open(m.action.projectId);
      router.push(api.href("/chat"));
    }
  };

  const filled = (["brand", "website", "handles", "who", "what", "when", "where", "why"] as FieldKey[]).filter((f) => s.sources[f] === "unknown" || (f === "handles" ? !!s.profile.handles?.length || !!s.profile.noAccounts : !!s.profile[f])).length;
  const confirming = s.step === "confirm";

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col bg-paper-0" aria-label="New brand intake">
        <header className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3", chatX)}>
          <Chip tone="brand">New brand{s.draftId ? " · resuming draft" : ""}</Chip>
          <span className="text-[13px] text-ink-500">
            Question <span className="font-mono">{Math.min(s.asked + (confirming ? 0 : 1), MAX_QUESTIONS)}</span> of at most <span className="font-mono">{MAX_QUESTIONS}</span>
          </span>
          <Btn size="sm" variant="ghost" className="ml-auto" onClick={leave}>
            <Save className="size-4" aria-hidden /> Save draft &amp; exit
          </Btn>
        </header>

        <div role="log" aria-label="Conversation" aria-live="polite" className={cn("min-h-0 flex-1 overflow-y-auto py-6", chatX)}>
          <div className="mx-auto max-w-chat space-y-6">
            {state.intakeLog.map((m) => (
              <MessageView key={m.id} msg={m} role={state.role} readOnly onAction={onAction} />
            ))}
            {busy && <Typing label={tr(lang, "Reading the website and socials…", "Membaca website dan media sosial…")} />}

            {confirming && (
              // BRAND "Confirm card": Title 800 26, rows of label (grey) — value + status, then one Orange button (flex-1) and an outline one
              <section aria-labelledby="confirm-title" className="rounded-card border border-hairline bg-paper-0 p-6 shadow-raised sm:p-8">
                <h2 id="confirm-title" className="font-title text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink-800">
                  {tr(lang, "Create this brand?", "Buat brand ini?")}
                </h2>
                <dl className="mt-6 space-y-4">
                  {ROWS.filter((r) => r.key === "brand" || r.key === "website" || r.key === "handles").map((r) => (
                    <div key={r.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <dt className="text-[14px] text-ink-500">{lang === "id" ? r.id : r.en}</dt>
                      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
                        <span className={cn("min-w-0 break-words text-[15px] text-ink-800", r.key === "brand" ? "font-semibold" : "font-mono text-[14px]")}>
                          {r.key === "handles" && s.profile.noAccounts ? tr(lang, "no social accounts", "tanpa akun sosial") : valueOf(s.profile, r.key)}
                        </span>
                        <StatusChip kind={fieldKind(s, r.key)} lang={lang} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 text-[13px] leading-[1.5] text-ink-500">
                  {tr(lang, "Nothing appears in Project until you create it. Creating does not start an audit — an admin still has to approve the positioning line and lock the profile.", "Belum ada yang muncul di Project sampai Anda membuatnya. Membuat tidak memulai audit — admin tetap harus menyetujui kalimat positioning dan mengunci profil.")}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Btn variant="primary" className="min-w-40 flex-1" disabled={!canCreate(s)} onClick={create}>
                    {tr(lang, "Create brand", "Buat brand")}
                  </Btn>
                  <Btn
                    variant="secondary"
                    onClick={() => {
                      setCardOpen(true);
                      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "center" }));
                    }}
                  >
                    {tr(lang, "Edit details", "Ubah detail")}
                  </Btn>
                  <Btn variant="ghost" onClick={leave}>
                    {tr(lang, "Cancel", "Batal")}
                  </Btn>
                </div>
              </section>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* below xl the card folds into the page; at xl it sits beside the chat */}
        <div ref={cardRef} className={cn("pb-3 xl:hidden", chatX)}>
          <details open={cardOpen || confirming} onToggle={(e) => setCardOpen((e.currentTarget as HTMLDetailsElement).open)} className="group mx-auto max-w-chat rounded-bubble bg-paper-100">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-bubble px-5 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              {tr(lang, "Profile card", "Kartu profil")} <span className="font-mono text-[13px] font-medium text-ink-500">· {filled}/8</span>
              <ChevronDown className="ml-auto size-5 text-ink-500 group-open:rotate-180" aria-hidden />
            </summary>
            <div className="max-h-[50dvh] overflow-y-auto p-3 pt-0">
              <ProfileCard state={s} lang={lang} editable={confirming} onEdit={edit} />
            </div>
          </details>
        </div>

        <Composer
          mode="intake"
          onSend={submit}
          disabled={busy || confirming}
          placeholder={confirming ? tr(lang, "Check the card, then create the brand", "Cek kartunya, lalu buat brand-nya") : tr(lang, "Type your answer — English or Bahasa Indonesia", "Ketik jawaban — Bahasa Indonesia atau English")}
        />
      </section>

      <aside aria-label="Profile card" className="hidden w-[22rem] shrink-0 overflow-y-auto bg-paper-100 p-6 xl:block">
        <ProfileCard state={s} lang={lang} editable={confirming} onEdit={edit} />
      </aside>
    </div>
  );
}
