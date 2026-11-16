import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getHubUser } from "@/lib/hub/session";
import { isEmail, normalizeEmail, safeNext } from "@/lib/hub/rules";
import { HubLoginForm } from "@/components/hub/login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function HubLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getHubUser()) redirect(next);
  const email = normalizeEmail(sp.email);
  return <HubLoginForm next={next} presetEmail={isEmail(email) ? email : undefined} />;
}
