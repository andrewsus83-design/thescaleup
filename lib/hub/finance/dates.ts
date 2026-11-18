/** The last day of a YYYY-MM month, as YYYY-MM-DD. */
export const lastDayOfMonth = (month: string) => `${month}-${String(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;
