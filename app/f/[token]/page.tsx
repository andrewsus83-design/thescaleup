import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicLeadForm } from "@/components/hub/crm/public-lead-form";
import { getFormByToken } from "@/lib/hub/crm/form-data";
import { issueStamp } from "@/lib/hub/crm/form-guard";
import { TOKEN } from "@/lib/hub/crm/forms";
import { unsubscribeKey } from "@/lib/hub/email/secret";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const found = TOKEN.test(token) ? await getFormByToken(token) : null;
  return { title: found ? found.form.title || found.form.name : "Form", robots: { index: false, follow: false } };
}

// Public page: no sign-in. A lead form a brand shares by link or embeds on its website.
export default async function LeadFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) notFound();
  const found = await getFormByToken(token);
  if (!found) notFound();
  const { form, brandName } = found;
  const key = unsubscribeKey();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10 text-ink-800">
      <p className="mb-2 text-small font-semibold text-ink-500 [overflow-wrap:anywhere]">{brandName}</p>
      <h1 className="font-title text-h2 [overflow-wrap:anywhere]">{form.title || form.name}</h1>
      {!form.enabled ? (
        <p className="mt-4 text-body text-ink-700">This form is not taking answers right now. Please come back later or contact {brandName} another way.</p>
      ) : (
        <>
          {form.intro && <p className="mt-3 text-body whitespace-pre-line text-ink-700 [overflow-wrap:anywhere]">{form.intro}</p>}
          <div className="relative mt-6">
            <PublicLeadForm
              token={form.token}
              stamp={key ? issueStamp(form.id, key) : ""}
              fields={{ email_mode: form.email_mode, phone_mode: form.phone_mode, ask_company: form.ask_company, ask_message: form.ask_message, consent_text: form.consent_text }}
            />
          </div>
        </>
      )}
    </main>
  );
}
