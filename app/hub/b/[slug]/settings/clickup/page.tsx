import { redirect } from "next/navigation";

// The ClickUp importer now lives under Settings, Import. Old links and bookmarks land there.
export default async function OldClickUpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/hub/b/${slug}/settings/import/clickup`);
}
