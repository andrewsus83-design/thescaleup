"use client";

// The guided intake for a new brand: one question at a time, the website read, only the gaps asked, a live
// profile card, then an explicit "Create this brand?" confirmation. Nothing exists in Project until Create.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Save } from "lucide-react";
import { answer, detectLang, editField, MAX_QUESTIONS, canCreate, question, readingNote, toProject, tr } from "@/lib/room/intake";
import type { FieldKey, Lang, MessageAction } from "@/lib/room/types";
import { useRoom } from "../room-provider";
import { Btn, Chip } from "../ui";
import { Composer } from "./composer";
import { MessageView, Typing, type ActionChoice } from "./messages";
import { ProfileCard } from "./profile-card";

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

  const create = () => {
    const p = toProject(s, state.projects, "active");
    api.createProject(p, {
      id: uid(),
      role: "assistant",
      text: tr(
        lang,
        `“${p.name}” is created and this chat continues inside it. Next: an admin approves the positioning line, the profile is locked, and then the first audit can run. Until then I can only help complete and lock the profile.`,
        `“${p.name}” sudah dibuat dan chat ini berlanjut di dalamnya. Berikutnya: admin menyetujui kalimat positioning, profil dikunci, lalu audit pertama bisa dijalankan. Sampai saat itu saya hanya membantu melengkapi dan mengunci profil.`,
      ),
      used: [{ kind: "profile", label: "Profile (draft)" }],
    });
    api.toast(`“${p.name}” created`);
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
      <section className="flex min-w-0 flex-1 flex-col" aria-label="New brand intake">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3">
          <Chip tone="coral" icon={<FilePlus2 className="h-3 w-3" aria-hidden />}>New brand{s.draftId ? " · resuming draft" : ""}</Chip>
          <span className="text-xs text-slate-300">
            Question {Math.min(s.asked + (confirming ? 0 : 1), MAX_QUESTIONS)} of at most {MAX_QUESTIONS}
          </span>
          <Btn size="sm" variant="ghost" className="ml-auto" onClick={leave}>
            <Save className="h-4 w-4" aria-hidden /> Save draft &amp; exit
          </Btn>
        </header>

        <div role="log" aria-label="Conversation" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto max-w-3xl space-y-5">
            {state.intakeLog.map((m) => (
              <MessageView key={m.id} msg={m} role={state.role} readOnly onAction={onAction} />
            ))}
            {busy && <Typing label={tr(lang, "Reading the website and socials…", "Membaca website dan media sosial…")} />}

            {confirming && (
              <div className="rounded-2xl border border-coral/30 bg-coral/5 p-4">
                <h2 className="font-display text-base font-bold">{tr(lang, "Create this brand?", "Buat brand ini?")}</h2>
                <p className="mt-1.5 text-sm text-slate-200">
                  <span className="font-semibold">{s.profile.brand}</span> · {s.profile.website} ·{" "}
                  {s.profile.noAccounts ? tr(lang, "no social accounts", "tanpa akun sosial") : s.profile.handles?.join(" ")}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {tr(lang, "Nothing appears in Project until you create it. Creating does not start an audit — an admin still has to approve the positioning line and lock the profile.", "Belum ada yang muncul di Project sampai Anda membuatnya. Membuat tidak memulai audit — admin tetap harus menyetujui kalimat positioning dan mengunci profil.")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn variant="primary" disabled={!canCreate(s)} onClick={create}>
                    {tr(lang, "Create", "Buat")}
                  </Btn>
                  <Btn
                    variant="secondary"
                    onClick={() => {
                      setCardOpen(true);
                      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "center" }));
                    }}
                  >
                    {tr(lang, "Edit", "Ubah")}
                  </Btn>
                  <Btn variant="ghost" onClick={leave}>
                    {tr(lang, "Cancel", "Batal")}
                  </Btn>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* below xl the card folds into the page; at xl it sits beside the chat */}
        <div ref={cardRef} className="mx-4 mb-2 xl:hidden">
          <details open={cardOpen || confirming} onToggle={(e) => setCardOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-2xl border border-white/10 bg-card/40">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 [&::-webkit-details-marker]:hidden">
              {tr(lang, "Profile card", "Kartu profil")} <span className="font-normal text-slate-300">· {filled}/8</span>
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

      <aside aria-label="Profile card" className="hidden w-96 shrink-0 overflow-y-auto border-l border-white/8 p-4 xl:block">
        <ProfileCard state={s} lang={lang} editable={confirming} onEdit={edit} />
      </aside>
    </div>
  );
}
