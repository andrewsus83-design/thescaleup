import type { Metadata } from "next";
import { BarChart3, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { SectionList } from "@/components/hub/section-list";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "finance");
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Finance" description="Accounting and management for the brand." />
      <SectionList
        items={[
          { key: "accounting", title: "Accounting", hint: "Income, expenses, invoices and the books", icon: BookOpen, soon: true },
          { key: "management", title: "Management", hint: "Budgets, cash flow and reports for the founder", icon: BarChart3, soon: true },
        ]}
      />
    </div>
  );
}
