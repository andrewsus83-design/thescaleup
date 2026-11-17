import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { accessFor } from "../access";
import { allow } from "../ratelimit";
import { getBrandKey } from "../secrets";
import { isBrandRole, type Actor } from "../rules";
import { audit, type HubUser } from "../session";
import { UUID } from "../tasks/context";
import { getWorkflow, listTasksService } from "../tasks/data";
import { fmtDay, hubTz, todayIn } from "../tasks/dates";
import { shortName, TASK_COLUMNS, type Task } from "../tasks/model";
import { canCreate, canMoveToStage, canSeeStage, startStatus, statusForStage, validateTaskInput } from "../tasks/rules";
import { loadToday } from "../today/data";
import { todayMessage } from "../today/model";
import { answerCallback, getMe, sendMessage, type Button } from "./api";
import { CODE_MINUTES, codeFrom, HELP, leadingDay, NOT_LINKED, parseCommand, parseIncoming, readCode, taskList, trailingDue, type ChatRef, type Incoming, type ListedTask } from "./bot-model";

// The bot: what happens when someone writes to it. Every message is a command from a Telegram account, and a Telegram account only means
// something once its owner has linked it to their hub login with a one-time code. From then on a command runs as that person, with the role
// and menu access they have in this brand right now (checked on every command, so removing someone from the team stops their bot too).
//
// Replies are plain text. Lists of a person's own tasks only ever go to their private chat, never into a group.

type Message = Extract<Incoming, { kind: "message" }>;
type Callback = Extract<Incoming, { kind: "callback" }>;
type Person = { userId: string; email: string; actor: Actor; who: { actor: Actor; level: "none" | "view" | "edit"; userId: string }; access: Awaited<ReturnType<typeof accessFor>>; chatId: number };
type Env = { brandId: string; brandName: string; token: string; botUsername: string | null; admin: ReturnType<typeof createSupabaseAdminClient> };

const MAX_OPEN = 8;
const DAY = () => todayIn(hubTz());

// A bot's username does not change, so ask Telegram once in a while, not on every message.
const names = new Map<string, { name: string | null; until: number }>();
async function botName(token: string): Promise<string | null> {
  const hit = names.get(token);
  if (hit && hit.until > Date.now()) return hit.name;
  const me = await getMe(token);
  const name = me.ok ? me.data.username : null;
  names.set(token, { name, until: Date.now() + (name ? 10 * 60_000 : 30_000) });
  return name;
}

async function personFor(env: Env, userId: string, chatId: number): Promise<Person | null> {
  const { data: pa } = await env.admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  let actor: Actor | null = pa ? "owner" : null;
  if (!actor) {
    const { data: m } = await env.admin.from("brand_members").select("role").eq("brand_id", env.brandId).eq("user_id", userId).maybeSingle();
    actor = m && isBrandRole(m.role) ? m.role : null;
  }
  if (!actor) return null;
  const [access, u] = await Promise.all([accessFor(env.brandId, actor), env.admin.auth.admin.getUserById(userId)]);
  return { userId, email: u.data.user?.email ?? "unknown", actor, who: { actor, level: access.tasks, userId }, access, chatId };
}

const hubUser = (p: Person): HubUser => ({ id: p.userId, email: p.email, isOwner: p.actor === "owner" });

const say = (env: Env, chatId: number, text: string, buttons?: Button[][]) => sendMessage(env.token, chatId, text, { buttons });

// ---------------------------------------------------------------------------------------------- entry
/** One update from Telegram. Never throws: whatever goes wrong is logged and Telegram still gets its "ok", so it does not resend. */
export async function handleUpdate(brandId: string, raw: unknown): Promise<void> {
  try {
    const inc = parseIncoming(raw);
    if (!inc) return;
    const admin = createSupabaseAdminClient();
    const [{ data: brand }, token] = await Promise.all([admin.from("brands").select("name, status").eq("id", brandId).maybeSingle(), getBrandKey(brandId, "telegram", false)]);
    if (!brand || brand.status === "archived" || !token) return;

    // At most once: a message Telegram sends again (because we were slow) is dropped, so "/add" can never add twice.
    const { error: dup } = await admin.from("telegram_updates").insert({ brand_id: brandId, update_id: inc.updateId });
    if (dup) {
      if (dup.code !== "23505") console.error("[telegram-bot] cannot record update:", dup.message);
      return;
    }
    // Remember the chat, so it can be found and linked even while commands are on.
    await admin.from("telegram_seen").upsert({ brand_id: brandId, chat_id: inc.chat.id, kind: inc.chat.kind, title: inc.chat.title, seen_at: new Date().toISOString() }, { onConflict: "brand_id,chat_id" });
    if (inc.kind === "joined") return;

    const env: Env = { brandId, brandName: String(brand.name ?? "the hub"), token, botUsername: await botName(token), admin };
    if (inc.kind === "callback") return await onCallback(env, inc);
    await onMessage(env, inc);
  } catch (e) {
    console.error("[telegram-bot] update failed:", e instanceof Error ? e.message : e);
  }
}

async function groupLinked(env: Env, chat: ChatRef): Promise<boolean> {
  if (chat.kind === "private") return true;
  const { data } = await env.admin.from("telegram_chats").select("chat_id").eq("brand_id", env.brandId).eq("chat_id", chat.id).maybeSingle();
  return !!data;
}

async function onMessage(env: Env, m: Message): Promise<void> {
  const isPrivate = m.chat.kind === "private";
  if (m.chat.kind === "channel") return;
  // A bot can be added to any group. Only groups the team linked in Settings get answers.
  if (!(await groupLinked(env, m.chat))) return;
  if (!allow(`tg:${env.brandId}:${m.fromId}`, 300)) return;

  const cmd = parseCommand(m.text, env.botUsername);
  if (!cmd) {
    if (isPrivate) {
      const link = await linkOf(env, m.fromId);
      await say(env, m.chat.id, link ? "I only understand commands. Try /help." : NOT_LINKED);
    }
    return;
  }

  if (cmd.cmd === "start" || cmd.cmd === "link") {
    if (!isPrivate) return void (await say(env, m.chat.id, "Message me directly to link your account, so the code never appears in the group."));
    if (!cmd.args) {
      const link = await linkOf(env, m.fromId);
      return void (await say(env, m.chat.id, link ? `You are linked.\n\n${HELP}` : NOT_LINKED));
    }
    return await redeem(env, m, cmd.args);
  }

  const link = await linkOf(env, m.fromId);
  if (!link) {
    if (isPrivate) await say(env, m.chat.id, NOT_LINKED);
    return; // in a group an unknown person gets no reply, so the group is not filled with it
  }
  const me = await personFor(env, link.user_id, link.chat_id);
  if (!me) return void (await say(env, m.chat.id, `You are no longer on the ${env.brandName} team, so I cannot do that.`));

  switch (cmd.cmd) {
    case "help":
      return void (await say(env, m.chat.id, HELP));
    case "stop":
      await env.admin.from("telegram_links").delete().eq("brand_id", env.brandId).eq("tg_user_id", m.fromId);
      await audit({ actor: hubUser(me), brandId: env.brandId, action: "telegram.unlink.self", target: me.userId });
      return void (await say(env, m.chat.id, "Unlinked. I will not answer commands from this Telegram until you link it again."));
    case "today":
      return await cmdToday(env, me, m.chat);
    case "tasks":
      return await cmdTasks(env, me, m.chat);
    case "done":
      return await cmdDone(env, me, m.chat, cmd.args);
    case "add":
      return await cmdAdd(env, me, m.chat, trailingDue(cmd.args, DAY()), false);
    case "remind": {
      const lead = leadingDay(cmd.args, DAY());
      if (!lead || !lead.rest) return void (await say(env, m.chat.id, "Say when and what, like: /remind tomorrow call Dewi. Days: today, tomorrow (besok), mon to sun, or 2026-12-01."));
      return await cmdAdd(env, me, m.chat, { title: lead.rest, due: lead.due }, true);
    }
    default:
      if (isPrivate) await say(env, m.chat.id, "I do not know that one. Try /help.");
  }
}

const linkOf = async (env: Env, tgUserId: number) => (await env.admin.from("telegram_links").select("user_id, chat_id").eq("brand_id", env.brandId).eq("tg_user_id", tgUserId).maybeSingle()).data as { user_id: string; chat_id: number } | null;

// ---------------------------------------------------------------------------------------------- linking
/** A fresh code for this person, shown in the hub. Only its hash is stored; it works once and expires. */
export async function makeLinkCode(brandId: string, userId: string): Promise<{ code: string; minutes: number } | null> {
  const admin = createSupabaseAdminClient();
  let code = "";
  while (code.length < 8) code = codeFrom(randomBytes(24));
  await admin.from("telegram_codes").delete().eq("brand_id", brandId).eq("user_id", userId); // one open code per person
  const { error } = await admin.from("telegram_codes").insert({ code_hash: hashCode(code), brand_id: brandId, user_id: userId, expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString() });
  if (error) {
    console.error("[telegram-bot] cannot save code:", error.message);
    return null;
  }
  return { code, minutes: CODE_MINUTES };
}

export const hashCode = (code: string) => createHash("sha256").update(`telegram-link:${code}`).digest("hex");

async function redeem(env: Env, m: Message, raw: string): Promise<void> {
  const bad = "That code did not work. It may have expired or already been used. Get a new one in the hub (Settings, Telegram, Link my Telegram).";
  // Guessing: eight characters from 31, so a wrong guess is never close, and each Telegram account gets only a few tries an hour.
  if (!allow(`tg-code:${env.brandId}:${m.fromId}`, 8)) return void (await say(env, m.chat.id, "Too many tries. Wait an hour, or get a new code in the hub."));
  const code = readCode(raw);
  if (!code) return void (await say(env, m.chat.id, bad));
  // Deleting and reading in one step is what makes a code work once, even if it arrives twice at the same moment.
  const { data: used } = await env.admin.from("telegram_codes").delete().eq("code_hash", hashCode(code)).eq("brand_id", env.brandId).select("user_id, expires_at");
  const row = used?.[0];
  if (!row || new Date(String(row.expires_at)).getTime() < Date.now()) return void (await say(env, m.chat.id, bad));

  const me = await personFor(env, String(row.user_id), m.chat.id);
  if (!me) return void (await say(env, m.chat.id, bad));
  const { error } = await env.admin.from("telegram_links").upsert({ brand_id: env.brandId, user_id: me.userId, tg_user_id: m.fromId, chat_id: m.chat.id }, { onConflict: "brand_id,user_id" });
  if (error) {
    // 23505: this Telegram account is already linked to someone else here.
    if (error.code === "23505") return void (await say(env, m.chat.id, "This Telegram is already linked to someone else in this brand. Send /stop from it first, then try again."));
    console.error("[telegram-bot] cannot link:", error.message);
    return void (await say(env, m.chat.id, "Could not link right now. Try again in a minute."));
  }
  await audit({ actor: hubUser(me), brandId: env.brandId, action: "telegram.link.self", target: me.userId });
  await say(env, m.chat.id, `Linked. You are ${shortName(me.email)} in ${env.brandName}.\n\n${HELP}`);
}

// ---------------------------------------------------------------------------------------------- commands
/** Answers that name a person's own tasks go to their private chat. In a group they get a short note. */
async function privately(env: Env, me: Person, chat: ChatRef, text: string, buttons?: Button[][]): Promise<void> {
  if (chat.kind === "private") return void (await say(env, chat.id, text, buttons));
  const sent = await say(env, me.chatId, text, buttons);
  await say(env, chat.id, sent.ok ? "Sent to you privately." : "I could not message you privately. Open a chat with me, send /start, then ask again.");
}

async function cmdToday(env: Env, me: Person, chat: ChatRef): Promise<void> {
  if (me.access.tasks === "none") return void (await say(env, chat.id, "Your role cannot open Tasks in this brand."));
  // Mail is left out: opening it in the hub needs a second step, and a count in Telegram would skip it.
  const t = await loadToday({ brandId: env.brandId, actor: me.actor, userId: me.userId, access: { ...me.access, mail: "none" }, day: DAY(), scope: "me", service: true });
  await privately(env, me, chat, todayMessage(env.brandName, t));
}

const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** The person's open work, soonest due first. */
async function myOpen(env: Env, me: Person): Promise<Task[]> {
  const all = await listTasksService(env.brandId, me.actor, { userId: me.userId, assignee: "me", limit: 300 });
  return all
    .filter((t) => (t.stage === "active" || t.stage === "review") && canSeeStage(me.actor, t.stage))
    .sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : (a.due_date ?? "9999") > (b.due_date ?? "9999") ? 1 : (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2));
}

const listed = (t: Task, day: string): ListedTask => ({ id: t.id, title: t.title, due: t.due_date, priority: t.priority, late: !!t.due_date && t.due_date < day });

/** One "done" button per task the person may close, four to a row, labelled with the number in the list. */
function doneButtons(me: Person, tasks: readonly Task[]): Button[][] {
  const rows: Button[][] = [];
  tasks.forEach((t, i) => {
    if (!canMoveToStage(me.who, t, "closed")) return;
    if (i % 4 === 0 || rows.length === 0) rows.push([]);
    rows[rows.length - 1].push({ text: `Done ${i + 1}`, data: `d:${t.id}` });
  });
  return rows;
}

async function cmdTasks(env: Env, me: Person, chat: ChatRef): Promise<void> {
  if (me.access.tasks === "none") return void (await say(env, chat.id, "Your role cannot open Tasks in this brand."));
  const open = await myOpen(env, me);
  const shown = open.slice(0, MAX_OPEN);
  const day = DAY();
  await privately(env, me, chat, taskList(shown.map((t) => listed(t, day)), open.length - shown.length), doneButtons(me, shown));
}

async function closeTask(env: Env, me: Person, taskId: string): Promise<{ ok: true; title: string; already: boolean } | { ok: false; error: string }> {
  if (!UUID.test(taskId)) return { ok: false, error: "That task is gone." };
  const { data } = await env.admin.from("tasks").select(TASK_COLUMNS).eq("brand_id", env.brandId).eq("id", taskId).maybeSingle();
  const task = data as Task | null;
  if (!task || !canSeeStage(me.actor, task.stage)) return { ok: false, error: "That task is gone." };
  if (task.stage === "closed") return { ok: true, title: task.title, already: true };
  if (!canMoveToStage(me.who, task, "closed")) return { ok: false, error: "You cannot close that task." };
  const workflow = await getWorkflow(env.brandId);
  const status = statusForStage(workflow, "closed");
  if (!status) return { ok: false, error: "This brand has no done status. Check Settings." };
  // Close only what is still where we read it, so two taps cannot collide.
  const { data: moved, error } = await env.admin.from("tasks").update({ status }).eq("id", task.id).eq("brand_id", env.brandId).eq("stage", task.stage).select("id");
  if (error || !moved?.length) return { ok: false, error: "Could not close it. Try again." };
  await audit({ actor: hubUser(me), brandId: env.brandId, action: "task.move", target: task.id, meta: { from: task.status, to: status, via: "telegram" } });
  return { ok: true, title: task.title, already: false };
}

async function cmdDone(env: Env, me: Person, chat: ChatRef, args: string): Promise<void> {
  if (!args) return void (await say(env, chat.id, "Say part of the task's name, like: /done weekly report. Or send /tasks and tap Done."));
  const needle = args.toLowerCase();
  const hits = (await myOpen(env, me)).filter((t) => t.title.toLowerCase().includes(needle));
  if (hits.length === 0) return void (await say(env, chat.id, "None of your open tasks match that. Send /tasks to see them."));
  if (hits.length > 1) {
    const shown = hits.slice(0, MAX_OPEN);
    const day = DAY();
    return await privately(env, me, chat, `More than one matches. Tap the one you mean.\n\n${taskList(shown.map((t) => listed(t, day)), hits.length - shown.length)}`, doneButtons(me, shown));
  }
  const r = await closeTask(env, me, hits[0].id);
  await say(env, chat.id, r.ok ? (r.already ? `Already done: ${r.title}` : `Done: ${r.title}`) : r.error);
}

async function onCallback(env: Env, cb: Callback): Promise<void> {
  const reply = (text: string) => answerCallback(env.token, cb.callbackId, text);
  if (!(await groupLinked(env, cb.chat))) return void (await reply(""));
  const link = await linkOf(env, cb.fromId);
  const me = link ? await personFor(env, link.user_id, link.chat_id) : null;
  if (!me) return void (await reply("Link your account first: send /start to me."));
  if (!allow(`tg:${env.brandId}:${cb.fromId}`, 300)) return void (await reply("Slow down for a moment."));
  if (!cb.data.startsWith("d:")) return void (await reply(""));
  const r = await closeTask(env, me, cb.data.slice(2));
  await reply(r.ok ? (r.already ? "Already done." : `Done: ${r.title}`.slice(0, 190)) : r.error);
}

async function cmdAdd(env: Env, me: Person, chat: ChatRef, input: { title: string; due: string | null }, reminder: boolean): Promise<void> {
  if (!input.title) return void (await say(env, chat.id, "Say what to add, like: /add Post the Friday reel due fri"));
  if (!canCreate(me.who)) return void (await say(env, chat.id, "Your role cannot add tasks in this brand."));
  if (!allow(`tg-add:${me.userId}`, 60)) return void (await say(env, chat.id, "That is a lot of tasks in an hour. Try again later."));
  const v = validateTaskInput({ title: input.title, dueDate: input.due ?? "", assigneeId: me.userId, priority: "normal", tags: reminder ? "reminder" : "" }, new Set([me.userId]));
  if (!v.ok) return void (await say(env, chat.id, v.error));
  const workflow = await getWorkflow(env.brandId);
  const start = startStatus(workflow, me.actor);
  if (!start) return void (await say(env, chat.id, "This brand's workflow has no status to start in. Check Settings."));
  const { error } = await env.admin.from("tasks").insert({
    brand_id: env.brandId,
    ...v.value,
    status: start.status,
    source: "manual",
    created_by: me.userId,
    ...(start.stage === "proposed" ? {} : { approved_by: me.userId, approved_at: new Date().toISOString() }),
  });
  if (error) {
    console.error("[telegram-bot] add failed:", error.message);
    return void (await say(env, chat.id, "Could not add it. Try again."));
  }
  await audit({ actor: hubUser(me), brandId: env.brandId, action: "task.create", target: v.value.title.slice(0, 80), meta: { stage: start.stage, via: "telegram" } });
  const when = v.value.due_date ? `, due ${fmtDay(v.value.due_date)}` : "";
  await say(env, chat.id, start.stage === "proposed" ? `Added: ${v.value.title}${when}. It waits for the founder's approval.` : `Added: ${v.value.title}${when}.`);
}
