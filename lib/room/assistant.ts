// STAND-IN for the real turn handling: in the product, a small model labels each message's intent and a
// grounded model answers from the context bundle. Here keyword rules do both so the prototype is
// demonstrable offline. What it demonstrates is real UX: replies in the language of the message,
// grounded answers with chips for what they used, an honest "not in the bundle" fallback, and — above
// all — chat text never changes state: every change comes back as an explicit action card.

import { REPORTS } from "./mock";
import { FIVE_W, tr } from "./intake";
import { isOpen } from "./todos";
import type { Lang, MessageAction, Project, Role, Todo, UsedChip } from "./types";

export type Intent = "ask_report" | "change_todo" | "start_build" | "note_decision" | "command" | "off_topic" | "intake" | "unknown";

export type RouteInput = {
  text: string;
  lang: Lang;
  project: Project;
  todos: Todo[];
  role: Role;
};
export type RouteResult = { intent: Intent; text: string; used: UsedChip[]; action?: MessageAction };

export const COMMANDS: { cmd: string; hint: string; adminOnly?: boolean }[] = [
  { cmd: "/lock", hint: "Lock the profile (admin)", adminOnly: true },
  { cmd: "/audit", hint: "Run a new audit" },
  { cmd: "/todo", hint: "Add a to do" },
  { cmd: "/build", hint: "Start a build from a to do" },
];

const OFF_TOPIC = /\b(weather|cuaca|recipe|resep|bitcoin|crypto|football|bola|politik|politics|joke|lelucon|lirik|lyrics|horoscope|zodiak|movie|film)\b/i;
const REPORT_Q = /\b(report|laporan|score|skor|gap|gaps|audit|insight|insights|competitor|kompetitor|pesaing)\b/i;
const TODO_Q = /\b(to[- ]?dos?|tugas|tasks?|week 1|minggu|done|selesai|assign)\b/i;
const BUILD_Q = /\b(build|bangun|landing|faq|schema|halaman|page)\b/i;
const NOTE_Q = /\b(decide|decision|keputusan|catat|note)\b/i;

const profileChip = (p: Project): UsedChip => ({ kind: "profile", label: p.locked ? `Profile v${p.profileVersion ?? 1}` : "Profile (draft)" });

export function routeMessage({ text, lang, project, todos, role }: RouteInput): RouteResult {
  const t = text.trim();
  const open = todos.filter(isOpen);
  const todoChip: UsedChip = { kind: "todo", label: `To do ${open.length}` };

  // ---- slash commands
  if (t.startsWith("/")) {
    const [cmd, ...rest] = t.split(/\s+/);
    const arg = rest.join(" ").trim();
    switch (cmd.toLowerCase()) {
      case "/lock":
        if (project.locked) return { intent: "command", text: tr(lang, `The profile is already locked (v${project.profileVersion}).`, `Profil sudah terkunci (v${project.profileVersion}).`), used: [profileChip(project)] };
        if (role !== "admin") return { intent: "command", text: tr(lang, "Only an admin can lock the profile — it needs the positioning line approved.", "Hanya admin yang bisa mengunci profil — kalimat positioning harus disetujui dulu."), used: [profileChip(project)] };
        return { intent: "command", text: tr(lang, "Lock the profile as v1? Locking needs the positioning line approved first. Nothing changes until you confirm.", "Kunci profil sebagai v1? Penguncian butuh kalimat positioning yang disetujui. Tidak ada yang berubah sampai Anda konfirmasi."), used: [profileChip(project)], action: { type: "lock", state: "pending" } };
      case "/audit":
        if (!project.locked) return { intent: "command", text: tr(lang, "An audit needs a locked profile. Lock it first with /lock (admin).", "Audit butuh profil yang terkunci. Kunci dulu dengan /lock (admin)."), used: [profileChip(project)] };
        return { intent: "command", text: tr(lang, "Run a new audit for this brand? It will use up to $3.00 (the default run budget). Nothing runs until you confirm.", "Jalankan audit baru untuk brand ini? Biayanya maksimal $3,00 (budget standar). Tidak ada yang berjalan sampai Anda konfirmasi."), used: [profileChip(project)], action: { type: "audit", state: "pending" } };
      case "/todo":
        if (!arg) return { intent: "command", text: tr(lang, "Write the to do after the command, e.g. /todo Update the opening hours.", "Tulis tugasnya setelah perintah, mis. /todo Perbarui jam buka."), used: [] };
        return { intent: "change_todo", text: tr(lang, `Add this to do to ${project.name}? It goes under “Manual”.`, `Tambahkan tugas ini ke ${project.name}? Masuk ke “Manual”.`), used: [todoChip], action: { type: "todo", title: arg, state: "pending" } };
      case "/build": {
        if (!project.locked) return { intent: "command", text: tr(lang, "A build reads the locked profile, so lock it first.", "Build membaca profil yang terkunci, jadi kunci dulu."), used: [profileChip(project)] };
        const options = open.filter((x) => /builder/i.test(x.service ?? "")).slice(0, 3).map((x) => ({ todoId: x.id, title: x.title }));
        if (!options.length) return { intent: "start_build", text: tr(lang, "No open to do is waiting for a build right now.", "Tidak ada tugas yang menunggu build saat ini."), used: [todoChip] };
        return { intent: "start_build", text: tr(lang, "These open to dos can be built. Pick one to start a draft — it stays linked to the to do.", "Tugas berikut bisa di-build. Pilih satu untuk memulai draf — tetap terhubung dengan tugasnya."), used: [todoChip, profileChip(project)], action: { type: "build", options, state: "pending" } };
      }
      default:
        return { intent: "command", text: tr(lang, `I don't know ${cmd}. Try ${COMMANDS.map((c) => c.cmd).join(", ")}.`, `Saya tidak mengenal ${cmd}. Coba ${COMMANDS.map((c) => c.cmd).join(", ")}.`), used: [] };
    }
  }

  // ---- "Note: …" is a note action
  if (/^(note|catatan)\s*:/i.test(t)) {
    const body = t.replace(/^(note|catatan)\s*:\s*/i, "");
    return { intent: "note_decision", text: tr(lang, "Save this as a note on the chronicle?", "Simpan ini sebagai catatan di kronik?"), used: [], action: { type: "note", text: body || t, state: "pending" } };
  }

  // ---- off-topic: short reply with two ways forward, never a context-free chat
  if (OFF_TOPIC.test(t)) {
    return { intent: "off_topic", text: tr(lang, "That's outside this project, so I won't answer it here. You can keep it as a note, or start a project for it.", "Itu di luar project ini, jadi tidak saya jawab di sini. Anda bisa menyimpannya sebagai catatan, atau membuat project untuknya."), used: [], action: { type: "offtopic", text: t, state: "pending" } };
  }

  // ---- intake mode: until the profile is locked, chat only helps complete and lock it
  if (!project.locked) {
    const missing = FIVE_W.filter((f) => !project.profile[f] && project.sources[f] !== "unknown");
    return {
      intent: "intake",
      text: tr(
        lang,
        `This project's profile isn't locked yet, so I can only help complete and lock it.${missing.length ? ` Still missing: ${missing.join(", ")}.` : " The 5W are filled in — an admin can approve the positioning line and /lock it."}`,
        `Profil project ini belum terkunci, jadi saya hanya bisa membantu melengkapi dan menguncinya.${missing.length ? ` Masih kosong: ${missing.join(", ")}.` : " 5W sudah lengkap — admin bisa menyetujui kalimat positioning lalu /lock."}`,
      ),
      used: [profileChip(project)],
    };
  }

  const report = REPORTS[project.id];

  // ---- grounded answers
  if (REPORT_Q.test(t) && report) {
    const top = report.insights.slice(0, 3).map((i, n) => `${n + 1}. ${i.title}`).join("\n");
    return {
      intent: "ask_report",
      text: tr(lang, `From audit #${report.audit} (score ${report.score}), the top gaps are:\n${top}\nOnly the report and profile were used — I did not check the live site.`, `Dari audit #${report.audit} (skor ${report.score}), celah terbesarnya:\n${top}\nHanya laporan dan profil yang dipakai — saya tidak memeriksa situs langsung.`),
      used: [{ kind: "report", label: `Report · audit #${report.audit}` }, profileChip(project)],
    };
  }
  if (TODO_Q.test(t)) {
    const next = open.slice(0, 3).map((x, n) => `${n + 1}. ${x.title}`).join("\n");
    return {
      intent: "change_todo",
      text: open.length
        ? tr(lang, `There are ${open.length} open to dos. Nearest first:\n${next}\nMove them across the board in Project → To do, or add one with /todo.`, `Ada ${open.length} tugas terbuka. Yang terdekat:\n${next}\nPindahkan statusnya di Project → To do, atau tambah dengan /todo.`)
        : tr(lang, "Nothing is open: every to do is done or rejected. Add a new one with /todo.", "Tidak ada yang terbuka: semua tugas sudah selesai atau ditolak. Tambah yang baru dengan /todo."),
      used: [todoChip],
    };
  }
  if (BUILD_Q.test(t)) {
    return { intent: "start_build", text: tr(lang, "A build starts from a to do. Use /build to pick one.", "Build dimulai dari sebuah tugas. Pakai /build untuk memilih."), used: [todoChip, profileChip(project)] };
  }
  if (NOTE_Q.test(t)) {
    return { intent: "note_decision", text: tr(lang, "To keep this as a decision, use “Pin as decision” on the message. To keep a note, start with “Note:”.", "Untuk menyimpan sebagai keputusan, pakai “Pin as decision” pada pesan. Untuk catatan, awali dengan “Note:”."), used: [] };
  }

  // ---- honest fallback: not in the bundle → say so and search knowledge instead of guessing
  return {
    intent: "unknown",
    text: tr(lang, "I can't find that in this project's context, and I won't guess. I searched the pinned and unpinned knowledge and found nothing relevant — add a note or upload a document and I'll answer from it.", "Saya tidak menemukannya di konteks project ini, dan saya tidak akan menebak. Saya sudah mencari di knowledge yang di-pin maupun tidak dan tidak menemukan yang relevan — tambahkan catatan atau unggah dokumen, lalu saya jawab dari situ."),
    used: [{ kind: "knowledge", label: "Knowledge · searched" }],
  };
}
