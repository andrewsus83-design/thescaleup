import type { Metadata } from "next";
import { ConnectDone } from "@/components/hub/social/connect-done";
import { readRedirect } from "@/lib/hub/zernio/model";

export const metadata: Metadata = { title: "Connecting an account" };
export const dynamic = "force-dynamic";

/** Where Zernio sends the person back to inside the pop-up, once the platform's own approval screen is done. */
export default async function ConnectDonePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ConnectDone outcome={readRedirect(await searchParams)} />;
}
