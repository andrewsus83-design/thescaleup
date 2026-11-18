import { Card } from "@/components/brand/primitives";

type Step = { title: string; body: React.ReactNode };
const b = (t: string) => <strong className="font-semibold text-ink-800">{t}</strong>;

const STEPS: Step[] = [
  { title: "Sign in to Xendit as the owner or an admin", body: <p>Open dashboard.xendit.co. Check the switch at the top of the dashboard: {b("Live")} for real payments, {b("Test")} to try this first with test payments.</p> },
  { title: "Open the API keys page", body: <p>Go to {b("Settings")}, then {b("Developers")}, then {b("API keys")}. Xendit may ask for your password again.</p> },
  { title: "Make a new secret key that can only read", body: (
      <>
        <p>Press {b("Generate secret key")} and name it, for example &quot;ScaleUp hub, read only&quot;.</p>
        <p>In the list of permissions set {b("Transaction")} to {b("Read")}. Leave every other line on {b("None")}: the hub does not need them, and a key that can only read cannot move money.</p>
      </>
    ) },
  { title: "Copy the key", body: <p>Xendit shows the key once. It starts with {b("xnd_production_")} (or {b("xnd_development_")} in test mode). Copy all of it.</p> },
  { title: "Paste it below and save", body: <p>Paste the key in the Xendit field on this page and press Save. It is stored encrypted, belongs to this brand only, and is never shown again: only its last four characters.</p> },
  { title: "Check the connection", body: <p>Press {b("Check connection")} next to the key. {b("Connected")} means the hub can read your payments. If it says the key is not allowed to read transactions, go back to step 3 and set Transaction to Read.</p> },
  { title: "Read your payments", body: <p>Open {b("Finance")}, then {b("Payments to review")}, and press {b("Get new payments")}. The first read goes back 31 days.</p> },
];

const FIXES: { q: string; a: React.ReactNode }[] = [
  { q: "The check says Xendit did not accept the key", a: <>Copy the whole key again with no space before or after it. A key that was deleted in Xendit stops working at once: make a new one.</> },
  { q: "The check says the key cannot read transactions", a: <>The key exists but has no Transaction permission. In Xendit, edit the key (or make a new one) and set Transaction to Read.</> },
  { q: "It says test mode, and I see no real payments", a: <>You saved a key that starts with xnd_development_. Switch the Xendit dashboard to Live, make a key there, and save that one here instead.</> },
  { q: "A payment is missing", a: <>Only payments that succeeded are read, and only in the currency your Finance books use. Refunds and withdrawals to your bank are not brought in.</> },
  { q: "I want to disconnect", a: <>Press Remove next to the key on this page. To be sure, also delete the key in Xendit. Payments already recorded in Finance stay as they are.</> },
];

/** A plain-language guide to connecting Xendit with a read-only key. */
export function XenditHowTo() {
  return (
    <Card>
      <h2 className="font-title text-h3 text-ink-800">How to connect Xendit</h2>
      <p className="mt-2 text-small text-ink-600">About five minutes. You need to be the owner or an admin of the brand&apos;s own Xendit account. The hub only reads payments: it cannot charge, refund or withdraw.</p>
      <ol className="mt-6 space-y-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-800 font-mono text-small font-medium text-paper-100">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-800">{s.title}</p>
              <div className="mt-1 space-y-2 text-small font-normal text-ink-600">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-field bg-paper-100 px-5 py-4 text-small font-normal text-ink-600">Xendit moves its menus now and then. If a name above is not where it says, look for &quot;API keys&quot; under Settings or Developers: the steps are the same.</p>
      <h3 className="mt-8 font-title text-h4 text-ink-800">If something does not work</h3>
      <dl className="mt-3 divide-y divide-ink-100">
        {FIXES.map((f) => (
          <div key={f.q} className="py-3">
            <dt className="text-small font-semibold text-ink-800">{f.q}</dt>
            <dd className="mt-1 text-small font-normal text-ink-600">{f.a}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
