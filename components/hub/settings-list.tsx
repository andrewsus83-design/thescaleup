import Link from "next/link";
import { ChevronRight, KeyRound, Mail, Share2, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { Chip } from "@/components/brand/primitives";
import { cardCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

const SECTIONS: { path: string; title: string; hint: string; icon: LucideIcon; manage: boolean; soon?: boolean }[] = [
  { path: "security", title: "Password and security", hint: "Set or change the password you sign in with", icon: ShieldCheck, manage: false },
  { path: "integrations", title: "Integrations and API keys", hint: "AI models, search, scraping, cost control and Google", icon: KeyRound, manage: true },
  { path: "social", title: "Social media connections", hint: "Connect this brand's social accounts and WhatsApp", icon: Share2, manage: true },
  { path: "team", title: "Team", hint: "Founder, ops and viewers: who can do what", icon: Users, manage: true },
  { path: "mailbox", title: "Mailbox", hint: "Addresses, forwarding and DNS for the brand's domain", icon: Mail, manage: true, soon: true },
];

/** The sections of a brand's Settings. Anyone sees Security; the rest is for the founder and the agency. */
export function SettingsList({ slug, manage }: { slug: string; manage: boolean }) {
  return (
    <ul className="space-y-3">
      {SECTIONS.filter((s) => manage || !s.manage).map(({ path, title, hint, icon: Icon, soon }) => (
        <li key={path}>
          <Link href={`/hub/b/${slug}/settings/${path}`} className={cn(cardCls(true, true), "flex min-h-16 items-center gap-4")}>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-field bg-paper-100 text-ink-600">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-body font-semibold text-ink-800">{title}</span>
                {soon && <Chip tone="neutral">Coming next</Chip>}
              </span>
              <span className="block text-small text-ink-500">{hint}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
