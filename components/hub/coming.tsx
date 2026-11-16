import { EmptyState, PageHeader } from "@/components/brand/primitives";

/** Placeholder for a section that is built in a later release. */
export function Coming({ title, hint, icon }: { title: string; hint: string; icon: React.ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={icon} title="Coming next" hint={hint} />
    </>
  );
}
