/** Shown the moment a link is clicked, while the page's data loads. Same widths as the real pages so nothing jumps. */
const block = "rounded-field bg-paper-200 motion-safe:animate-pulse";

export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className={`${block} h-9 w-48`} />
      <div className={`${block} mt-3 h-4 w-72 max-w-full`} />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${block} h-16 w-full rounded-card`} />
        ))}
      </div>
    </div>
  );
}

/** For a first visit to a brand, where the top bar and the tab bar are not on screen yet either. */
export function BrandSkeleton() {
  return (
    <>
      <div className="h-16 border-b border-ink-100 bg-paper-0" />
      <main className="mx-auto w-full px-5 pt-10 sm:w-[90%] sm:px-0">
        <PageSkeleton />
      </main>
    </>
  );
}
