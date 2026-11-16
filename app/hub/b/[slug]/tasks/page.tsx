import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { Coming } from "@/components/hub/coming";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return <Coming title="Tasks" icon={<CheckSquare className="size-6" aria-hidden />} hint="A ClickUp-style workspace: List, Board and Calendar views, comments, due dates and approvals. Chiefs propose, the founder approves." />;
}
