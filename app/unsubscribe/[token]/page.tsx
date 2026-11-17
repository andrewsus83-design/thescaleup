import type { Metadata } from "next";
import { readUnsubscribeLink, unsubscribe } from "@/lib/hub/email/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const mask = (email: string) => {
  const [u, d] = email.split("@");
  return `${u.slice(0, 1)}${"*".repeat(Math.max(1, Math.min(6, u.length - 1)))}@${d}`;
};

// Public page: no sign-in. Asks first, then stops all email from that brand to that address.
export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const raw = decodeURIComponent(token);
  const link = await readUnsubscribeLink(raw);

  async function confirm() {
    "use server";
    const { redirect } = await import("next/navigation");
    const ok = await unsubscribe(raw);
    redirect(`/unsubscribe/${encodeURIComponent(raw)}?done=${ok ? "1" : "0"}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-ink-800">
      <h1 className="font-title text-h2">{done === "1" ? "You are unsubscribed" : "Unsubscribe"}</h1>
      {!link ? (
        <p className="mt-4 text-body text-ink-700">This unsubscribe link is not valid. If you still get email you do not want, reply to it and ask to be removed.</p>
      ) : done === "1" ? (
        <p className="mt-4 text-body text-ink-700">{mask(link.email)} will not get email from {link.brand} any more. It can take a few minutes. If this was a mistake, write to them and ask to be added again.</p>
      ) : (
        <form action={confirm} className="mt-4 space-y-5">
          <p className="text-body text-ink-700">Stop all email from {link.brand} to {mask(link.email)}?</p>
          {done === "0" && <p className="text-small text-danger" role="alert">That did not work. Try again in a moment.</p>}
          <button type="submit" className="min-h-11 rounded-full bg-ink-900 px-6 text-small font-bold text-paper-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            Yes, unsubscribe me
          </button>
        </form>
      )}
    </main>
  );
}
