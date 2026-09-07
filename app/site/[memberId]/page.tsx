import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { coerceDoc } from "@/lib/builders/website/schema";
import { BlockView } from "@/components/builders/website/block-view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

async function load(memberId: string) {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    const [{ data: member }, { data: project }] = await Promise.all([
      db.from("leads").select("business, name").eq("id", memberId).maybeSingle(),
      db
        .from("builder_projects")
        .select("data")
        .eq("member_id", memberId)
        .eq("builder", "website")
        .eq("status", "submitted") // only PUBLISHED sites are served publicly
        .maybeSingle(),
    ]);
    return { member, data: project?.data as Record<string, unknown> | undefined };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId } = await params;
  const r = await load(memberId);
  // Public page — use business only, never the private contact person's name.
  const name = (r?.member?.business as string) || "Website";
  return { title: name, robots: { index: false, follow: false } };
}

export default async function SitePage({ params }: Params) {
  const { memberId } = await params;
  const r = await load(memberId);
  if (!r || !r.member) notFound();

  const brand = (r.member.business as string) || "Website";
  const blocks = Array.isArray(r.data?.blocks) ? r.data!.blocks : [];

  if (blocks.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">
            {brand}
          </h1>
          <p className="mt-3 text-slate-500">Website sedang disiapkan.</p>
        </div>
      </main>
    );
  }

  const doc = coerceDoc(r.data, brand);
  return (
    <main className="min-h-screen bg-white">
      {doc.blocks.map((b) => (
        <BlockView key={b.id} block={b} theme={doc.theme} />
      ))}
    </main>
  );
}
