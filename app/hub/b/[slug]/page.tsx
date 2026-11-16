import { redirect } from "next/navigation";

export default async function BrandHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/hub/b/${slug}/tasks`);
}
