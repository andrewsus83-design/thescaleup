import { permanentRedirect } from "next/navigation";

// Blog posts have moved under ScaleHub — preserve old URLs (301).
export default async function BlogPostRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/scalehub/${slug}`);
}
