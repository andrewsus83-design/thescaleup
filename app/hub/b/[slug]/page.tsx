import { redirect } from "next/navigation";

// Brand is the home tab: chronicle, health, tips and updates.
export default async function BrandHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/hub/b/${slug}/brand`);
}
