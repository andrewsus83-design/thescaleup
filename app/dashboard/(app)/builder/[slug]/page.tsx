import { redirect } from "next/navigation";

// The builder WIZARD is admin-only. On the client side, each builder is a
// finished product — moved to /dashboard/app/[slug].
export default async function ClientBuilderRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/dashboard/app/${slug}`);
}
