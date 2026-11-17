import "server-only";
import { parseKey } from "../crypto";
import { site } from "@/lib/site";

// The key that signs unsubscribe links. It is the workspace's encryption key (SECRETS_KEY_<n>), so there is nothing new to set up.
export function unsubscribeKey(): Buffer | null {
  const version = Number(process.env.SECRETS_KEY_CURRENT || 1) || 1;
  return parseKey(process.env[`SECRETS_KEY_${version}`]);
}

/** Where the public pages live (unsubscribe links point here). */
export const publicOrigin = () => ((process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() || site.url).replace(/\/$/, "");
