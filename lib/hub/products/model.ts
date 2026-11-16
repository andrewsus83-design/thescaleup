// Pure rules for Products and Stores: reading a table from a POS or Desty export, mapping its columns, merging rows, and the stock maths. No I/O.

export const STORE_KINDS = ["desty", "shopify", "pos", "marketplace", "other"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];
export const KIND_LABEL: Record<StoreKind, string> = { desty: "Desty", shopify: "Shopify", pos: "POS", marketplace: "Marketplace", other: "Other" };
export const isKind = (v: unknown): v is StoreKind => typeof v === "string" && (STORE_KINDS as readonly string[]).includes(v);

export const LIMITS = { bytes: 4_000_000, rows: 20_000, cols: 60, chunk: 500, cell: 300, name: 80, sku: 64, productName: 200 } as const;
export const DEFAULT_LOW = 5;

export function parseStore(get: (k: string) => string): { ok: true; value: { name: string; kind: StoreKind } } | { ok: false; error: string } {
  const name = get("name").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "Give the store a name." };
  if (name.length > LIMITS.name) return { ok: false, error: `Keep the name under ${LIMITS.name} characters.` };
  const kind = get("kind") || "other";
  if (!isKind(kind)) return { ok: false, error: "Pick a kind from the list." };
  return { ok: true, value: { name, kind } };
}

// ---------------------------------------------------------------------------------------------- reading a file

/** Text of a spreadsheet cell value, whatever shape the library gives it. */
export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || Math.abs(v) >= 1e15) return "";
    // Two decimals at most, so a cell like 1.234 is never mistaken for one thousand two hundred thirty-four when it is read back.
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  }
  if (typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellToString(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((p) => cellToString((p as Record<string, unknown>)?.text)).join("");
    if ("text" in o) return cellToString(o.text);
    if ("error" in o) return "";
  }
  return "";
}

const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, LIMITS.cell);

/** CSV text to rows. Picks the comma, semicolon or tab the first line uses (Indonesian Excel saves with semicolons), and reads quoted cells. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const head = t.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let q = false;
  for (const ch of head) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  const delim = (Object.keys(counts) as string[]).sort((a, b) => counts[b] - counts[a])[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  q = false;
  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (t[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows.map((r) => r.slice(0, LIMITS.cols).map(clip));
}

/**
 * A number as people write it in a sheet: "1,234.50", "1.234,50", "Rp 15.000", "(5)" for minus five.
 * "1.234" is read as one thousand two hundred thirty-four (the Indonesian way) unless it starts with 0; "1.5" is one and a half.
 */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const raw = v.trim();
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(raw)) {
    const e = Number(raw);
    return Number.isFinite(e) ? e : null;
  }
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  const neg = s.startsWith("-") || /^\(.*\)$/.test(raw);
  s = s.replace(/-/g, "");
  const dot = s.lastIndexOf(".");
  const comma = s.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    const d = Math.max(dot, comma);
    s = `${s.slice(0, d).replace(/[.,]/g, "")}.${s.slice(d + 1)}`;
  } else if (dot >= 0 || comma >= 0) {
    const sep = dot >= 0 ? "." : ",";
    const parts = s.split(sep);
    if (parts.length > 2) s = parts.join("");
    else if (parts[1].length === 3 && parts[0] !== "0" && parts[0].length >= 1 && parts[0].length <= 3) s = parts.join("");
    else s = `${parts[0]}.${parts[1]}`;
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

// ---------------------------------------------------------------------------------------------- mapping columns

export type Mapping = { sku: number; name: number; stock: number; price: number };
export const FIELDS: { key: keyof Mapping; label: string; required: boolean; hint: string }[] = [
  { key: "sku", label: "SKU (product code)", required: true, hint: "The code that is the same in every store" },
  { key: "stock", label: "Stock", required: true, hint: "How many are in this store" },
  { key: "name", label: "Product name", required: false, hint: "Used when the product is new" },
  { key: "price", label: "Price", required: false, hint: "This store's selling price" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const SYNONYMS: Record<keyof Mapping, string[]> = {
  sku: ["sku", "variantsku", "kodesku", "sellersku", "skupenjual", "skuinduk", "variationsku", "kodebarang", "kodeproduk", "kode", "itemcode", "productcode", "itemsku", "nomorsku"],
  stock: ["stock", "stok", "qty", "quantity", "available", "stoktersedia", "stokakhir", "jumlah", "onhand", "inventory", "inventoryquantity", "stoksaatini", "sisastok"],
  name: ["name", "nama", "namaproduk", "productname", "namabarang", "itemname", "title", "produk", "product", "namavariasi"],
  price: ["price", "harga", "hargajual", "sellingprice", "hargaeceran", "regularprice", "hargasatuan"],
};

/** The best column for each field, by the header's words. -1 when none looks right; a column is never given to two fields. */
export function guessMapping(headers: readonly string[]): Mapping {
  const heads = headers.map(norm);
  const used = new Set<number>();
  const out: Mapping = { sku: -1, name: -1, stock: -1, price: -1 };
  for (const key of ["sku", "stock", "price", "name"] as const) {
    let found = -1;
    for (const syn of SYNONYMS[key]) {
      found = heads.findIndex((h, i) => !used.has(i) && h === syn);
      if (found >= 0) break;
    }
    if (found < 0) {
      for (const syn of SYNONYMS[key]) {
        if (syn.length < 3) continue;
        found = heads.findIndex((h, i) => !used.has(i) && h.includes(syn));
        if (found >= 0) break;
      }
    }
    if (found >= 0) {
      out[key] = found;
      used.add(found);
    }
  }
  return out;
}

export function mappingError(m: Mapping): string | null {
  if (m.sku < 0) return "Pick the column that holds the SKU.";
  if (m.stock < 0) return "Pick the column that holds the stock.";
  if (m.sku === m.stock) return "SKU and stock cannot be the same column.";
  return null;
}

// ---------------------------------------------------------------------------------------------- rows

export type ImportRow = { sku: string; name: string; stock: number; price: number | null };

/** The same SKU as written differently: trimmed, spaces collapsed, lower case. */
export const skuKey = (sku: string) => sku.replace(/\s+/g, " ").trim().toLowerCase().slice(0, LIMITS.sku);

/** One row per SKU: stock added together (two warehouses, two variants), the first name and price kept. */
export function mergeRows(rows: readonly ImportRow[]): { rows: ImportRow[]; merged: number } {
  const by = new Map<string, ImportRow>();
  let merged = 0;
  for (const r of rows) {
    const k = skuKey(r.sku);
    const cur = by.get(k);
    if (!cur) by.set(k, { ...r });
    else {
      merged++;
      cur.stock += r.stock;
      if (!cur.name && r.name) cur.name = r.name;
      if (cur.price === null && r.price !== null) cur.price = r.price;
    }
  }
  return { rows: [...by.values()], merged };
}

const STOCK_MIN = -1_000_000;
const STOCK_MAX = 100_000_000;

/** The table's data rows (header already removed) as import rows. Counts what was left out so the person sees it before importing. */
export function toRows(table: readonly (readonly string[])[], m: Mapping): { rows: ImportRow[]; skipped: number; merged: number } {
  const out: ImportRow[] = [];
  let skipped = 0;
  const cell = (r: readonly string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  for (const r of table) {
    const sku = cell(r, m.sku).replace(/\s+/g, " ").slice(0, LIMITS.sku);
    const stock = parseNumber(cell(r, m.stock));
    if (!sku || stock === null) {
      skipped++;
      continue;
    }
    const whole = Math.round(stock);
    if (whole < STOCK_MIN || whole > STOCK_MAX) {
      skipped++;
      continue;
    }
    const price = parseNumber(cell(r, m.price));
    out.push({ sku, name: cell(r, m.name).slice(0, LIMITS.productName), stock: whole, price: price !== null && price >= 0 && price < 1e12 ? Math.round(price * 100) / 100 : null });
  }
  const merged = mergeRows(out);
  return { rows: merged.rows, skipped, merged: merged.merged };
}

/** A chunk the browser sent, checked again on the server. null when anything is off. */
export function cleanRows(raw: unknown): ImportRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.chunk * 2) return null;
  const out: ImportRow[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) return null;
    const o = r as Record<string, unknown>;
    const sku = typeof o.sku === "string" ? o.sku.replace(/\s+/g, " ").trim() : "";
    if (!sku || sku.length > LIMITS.sku) return null;
    if (typeof o.stock !== "number" || !Number.isInteger(o.stock) || o.stock < STOCK_MIN || o.stock > STOCK_MAX) return null;
    const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim().slice(0, LIMITS.productName) : "";
    const price = typeof o.price === "number" && Number.isFinite(o.price) && o.price >= 0 && o.price < 1e12 ? Math.round(o.price * 100) / 100 : null;
    out.push({ sku, name, stock: o.stock, price });
  }
  return mergeRows(out).rows;
}

// ---------------------------------------------------------------------------------------------- the catalog

export type StockState = "out" | "low" | "ok";
export type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  price: number | null;
  low: number | null;
  total: number;
  stores: { storeId: string; stock: number; price: number | null; at: string }[];
};

export function stockState(total: number, low: number | null): StockState {
  if (total <= 0) return "out";
  return total <= (low ?? DEFAULT_LOW) ? "low" : "ok";
}

export type CatalogSort = "name" | "stock";
export type CatalogFilter = { q: string; state?: StockState; storeId?: string; sort: CatalogSort };

export function filterCatalog(items: readonly CatalogItem[], f: CatalogFilter): CatalogItem[] {
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = items.filter((it) => {
    if (words.length && !words.every((w) => it.name.toLowerCase().includes(w) || it.sku.toLowerCase().includes(w))) return false;
    if (f.storeId && !it.stores.some((s) => s.storeId === f.storeId)) return false;
    if (f.state && stockState(it.total, it.low) !== f.state) return false;
    return true;
  });
  return out.sort(f.sort === "stock" ? (a, b) => a.total - b.total || a.name.localeCompare(b.name) : (a, b) => (a.name || a.sku).localeCompare(b.name || b.sku));
}

export function catalogTotals(items: readonly CatalogItem[]): { products: number; units: number; low: number; out: number } {
  let units = 0;
  let low = 0;
  let out = 0;
  for (const it of items) {
    units += Math.max(0, it.total);
    const s = stockState(it.total, it.low);
    if (s === "low") low++;
    else if (s === "out") out++;
  }
  return { products: items.length, units, low, out };
}

/** The lowest and highest price across the product's own and its stores' prices. */
export function priceRange(it: CatalogItem): { min: number; max: number } | null {
  const ps = [it.price, ...it.stores.map((s) => s.price)].filter((p): p is number => p !== null);
  return ps.length ? { min: Math.min(...ps), max: Math.max(...ps) } : null;
}

/** How many products and units each store holds, from the same catalog. */
export function storeTotals(items: readonly CatalogItem[]): Map<string, { products: number; units: number }> {
  const out = new Map<string, { products: number; units: number }>();
  for (const it of items) {
    for (const s of it.stores) {
      const cur = out.get(s.storeId) ?? { products: 0, units: 0 };
      cur.products++;
      cur.units += Math.max(0, s.stock);
      out.set(s.storeId, cur);
    }
  }
  return out;
}

export const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
/** A price as written in the file: thousands separators, up to two decimals, no currency (a brand can sell in more than one). */
export const fmtPrice = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
