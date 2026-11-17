import { Card } from "@/components/brand/primitives";
import { CopyText } from "@/components/hub/copy-text";

const TEAM_MESSAGE = `Hi team, we are connecting Telegram to our hub so reminders and daily summaries reach us here.

What you need to do:
1. Install Telegram (telegram.org) and sign in with your phone number.
2. Tap the invite link to our group: [paste the group link here]
3. That is all.

The bot posts updates from the hub. It does not keep your messages.`;

type Step = { title: string; body: React.ReactNode };

function Steps({ steps, from = 1 }: { steps: Step[]; from?: number }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-800 font-mono text-small font-medium text-paper-100">
            {from + i}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-800">{s.title}</p>
            <div className="mt-1 space-y-2 text-small text-ink-600">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const code = (t: string) => <code className="rounded bg-paper-100 px-1.5 py-0.5 font-mono text-caption text-ink-800">{t}</code>;

const FIXES: { q: string; a: React.ReactNode }[] = [
  { q: "The hub says the token is not accepted", a: <>Copy the whole token again from BotFather, with no spaces before or after it. If you lost the message, send {code("/token")} to @BotFather, pick your bot and it shows the token again.</> },
  { q: "Find chats shows nothing", a: <>The hub only sees messages from about the last 24 hours. Write a new message to the bot (or in the group, see Part 3), wait a few seconds, then press Find chats again. With commands on, the hub keeps the chats it has seen, so a message sent after you turned commands on is enough.</> },
  { q: "The bot ignores my code", a: <>Codes work once, only in a private chat with the bot, and expire after 15 minutes. Press Link my Telegram for a fresh one and send it again. After eight wrong tries in an hour the hub makes you wait.</> },
  { q: "Commands did not turn on", a: <>The hub shows the reason under Commands. If it says another tool is listening, that tool owns the bot: make a new bot for the hub. If it mentions the database step, ask the person who manages the database to run the latest migration.</> },
  { q: "The bot does not answer in the group", a: <>That is normal: in a group a bot only notices messages that call it by name. Send {code("/start@yourbotname")} in the group (use your bot&apos;s own username), then press Find chats.</> },
  { q: "The hub mentions a webhook", a: <>Another tool is already listening to this bot, and a bot can only have one listener. The simplest fix is to make a fresh bot for the hub with @BotFather and save its token here.</> },
  { q: "I want to stop the messages", a: <>Press Remove next to the chat above. To switch the bot off everywhere, send {code("/revoke")} to @BotFather: the old token stops working at once.</> },
];

/** A plain-language guide to connecting Telegram. `canConnect` is false for people who may read it but not connect: they only need the join steps. */
export function TelegramHowTo({ canConnect }: { canConnect: boolean }) {
  if (!canConnect) {
    return (
      <Card>
        <h2 className="text-h3 font-semibold text-ink-800">What you need to do</h2>
        <p className="mt-2 text-small text-ink-600">Only the owner or founder connects the Telegram bot. For you it is two steps:</p>
        <div className="mt-4">
          <Steps
            steps={[
              { title: "Install Telegram", body: <p>Get it at telegram.org and sign in with your phone number.</p> },
              { title: "Join the team group", body: <p>Ask your owner or founder for the group invite link and tap it. Updates from the hub arrive in that group.</p> },
            ]}
          />
        </div>
        <p className="mt-4 text-small text-ink-500">If your owner or founder has turned on commands, you can also link your own Telegram under Your Telegram on this page, then ask the bot for your tasks with /tasks, add one with /add, or mark one done with /done.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-8">
      <Card>
        <h2 className="text-h3 font-semibold text-ink-800">How to connect Telegram</h2>
        <p className="mt-2 text-small text-ink-600">No technical skill needed. It takes about five minutes, and you only do it once. You need Telegram on your phone or computer.</p>

        <h3 className="mt-6 mb-3 font-semibold text-ink-800">Part 1. Make your bot</h3>
        <Steps
          steps={[
            { title: "Open BotFather", body: <p>In Telegram, search for {code("@BotFather")} (the one with a blue tick) and tap Start.</p> },
            { title: "Ask for a new bot", body: <p>Send the message {code("/newbot")}.</p> },
            { title: "Choose a name", body: <p>First a name people will see, for example &quot;Acme Updates&quot;. Then a username that ends in {code("bot")}, for example {code("acme_updates_bot")}.</p> },
            { title: "Copy the token", body: <p>BotFather replies with a long line of numbers and letters with a colon in the middle. That is the token. Press and hold to copy it. Treat it like a password: do not post it in a chat or send it to anyone.</p> },
            { title: "Save it here", body: <p>Paste the token into the Telegram bot token box at the top of this page and save.</p> },
            { title: "Check the connection", body: <p>Press Check the connection below. You should see your bot&apos;s name. If not, see Fixes at the bottom.</p> },
          ]}
        />

        <h3 className="mt-8 mb-3 font-semibold text-ink-800">Part 2. Connect yourself</h3>
        <Steps
          from={7}
          steps={[
            { title: "Say hello to your bot", body: <p>In Telegram, search for your bot&apos;s username, open it, tap Start and send {code("hi")}.</p> },
            { title: "Link your chat", body: <p>Back here, press Find chats, then Link next to your name. The bot says hello in Telegram.</p> },
            { title: "Send a test", body: <p>Press Send a test next to the chat. If the message arrives in Telegram, you are done.</p> },
          ]}
        />

        <h3 className="mt-8 mb-3 font-semibold text-ink-800">Part 3. Connect a team group (optional)</h3>
        <Steps
          from={10}
          steps={[
            { title: "Make the group", body: <p>In Telegram create a new group and add your teammates. Everyone in the group sees what the bot posts, so only add people who should see it.</p> },
            { title: "Add the bot to the group", body: <p>Open the group, tap its name, Add members, search for your bot&apos;s username and add it.</p> },
            { title: "Wake the bot up in the group", body: <p>Send {code("/start@yourbotname")} in the group, using your bot&apos;s own username.</p> },
            { title: "Link the group", body: <p>Back here press Find chats, then Link next to the group, then Send a test.</p> },
          ]}
        />

        <h3 className="mt-8 mb-3 font-semibold text-ink-800">Part 4. Let your team use the bot (optional)</h3>
        <Steps
          from={14}
          steps={[
            { title: "Turn on commands", body: <p>Above, under Commands, press Turn on. A bot can only have one listener, so use a bot made for the hub.</p> },
            { title: "Everyone links their own Telegram", body: <p>Each person opens this page, presses Link my Telegram under Your Telegram, and sends the code to the bot in a private chat. The bot does everything as that person, with their role.</p> },
            { title: "Try it", body: <p>Send {code("/today")} or {code("/tasks")}. Send {code("/help")} to see every command.</p> },
          ]}
        />
      </Card>

      <Card>
        <h2 className="text-h3 font-semibold text-ink-800">Message for your team</h2>
        <p className="mt-2 mb-4 text-small text-ink-600">Copy this, add the group invite link (in Telegram: group name, Invite via link), and send it to the people who should join.</p>
        <CopyText text={TEAM_MESSAGE} label="Copy the message for your team" />
      </Card>

      <Card>
        <h2 className="text-h3 font-semibold text-ink-800">Fixes</h2>
        <div className="mt-3 divide-y divide-ink-100">
          {FIXES.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="min-h-11 cursor-pointer list-none py-2 font-semibold text-ink-800 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{f.q}</summary>
              <p className="pb-2 text-small text-ink-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
