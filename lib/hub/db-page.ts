// The database API returns at most 1,000 rows per request, however high a limit is asked for. A list that can be longer than
// that has to be read in pages, or it is cut off without any error.

export const API_PAGE = 1000;

type Page<T> = { data: T[] | null; error: { message: string } | null };

/** Every row of a query, 1,000 at a time. `page` must build a fresh query for each range. Throws on the first error; stops at `max` rows. */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>, max = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += API_PAGE) {
    const { data, error } = await page(from, Math.min(from + API_PAGE, max) - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < API_PAGE) break;
  }
  return out;
}
