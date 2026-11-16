import Link from "next/link";
import { segItem, segWrap } from "@/components/brand/styles";

/** The sections of Content. A section is listed only once it works and the person may use it. */
export function ContentNav({ slug, active, canEdit }: { slug: string; active: "calendar" | "write"; canEdit: boolean }) {
  const base = `/hub/b/${slug}/content`;
  return (
    <nav aria-label="Content sections" className={`${segWrap} mb-6`}>
      <Link href={base} aria-current={active === "calendar" ? "page" : undefined} className={segItem(active === "calendar")}>
        Calendar
      </Link>
      {canEdit && (
        <Link href={`${base}/write`} aria-current={active === "write" ? "page" : undefined} className={segItem(active === "write")}>
          Write
        </Link>
      )}
    </nav>
  );
}
