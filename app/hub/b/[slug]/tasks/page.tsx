import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { Coming } from "@/components/hub/coming";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Tasks" };

export const dynamic = "force-dynamic";

export default async function TasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "tasks");
  return <Coming title="Tasks" icon={<CheckSquare className="size-6" aria-hidden />} hint="A ClickUp-style workspace: List, Board and Calendar views, comments, due dates and approvals. Chiefs propose, the founder approves." />;
}
