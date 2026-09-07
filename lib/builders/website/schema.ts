// Shared schema for the visual website builder — now MULTI-PAGE (Home, Produk/
// Layanan, FAQ, Blog, Kontak) with a shared nav + footer. Plain module.

export type WebBlockType =
  | "hero"
  | "pageheader"
  | "features"
  | "about"
  | "products"
  | "testimonial"
  | "faq"
  | "posts"
  | "cta"
  | "contact"
  | "footer";

export type WebBlock = {
  id: string;
  type: WebBlockType;
  props: Record<string, unknown>;
};

export type Page = {
  id: string;
  slug: string; // "" = home
  name: string; // nav label
  blocks: WebBlock[];
};

export type WebsiteTheme = {
  primary: string;
  brand: string;
  logo?: string;
  whatsapp?: string;
};

export type WebsiteDoc = {
  theme: WebsiteTheme;
  pages: Page[];
};

export type FieldKind = "text" | "textarea" | "image" | "url";
export type FieldDef = { key: string; label: string; kind: FieldKind };
export type ListDef = {
  key: string;
  label: string;
  itemLabel: string;
  itemFields: FieldDef[];
  itemDefault: Record<string, string>;
};
export type BlockDef = {
  type: WebBlockType;
  label: string;
  hint: string;
  fields: FieldDef[];
  lists: ListDef[];
  defaults: Record<string, unknown>;
};

export const BLOCK_DEFS: BlockDef[] = [
  {
    type: "hero",
    label: "Hero",
    hint: "Pembuka besar dengan headline & tombol.",
    fields: [
      { key: "headline", label: "Headline", kind: "text" },
      { key: "subheadline", label: "Sub-headline", kind: "textarea" },
      { key: "ctaText", label: "Teks tombol", kind: "text" },
      { key: "ctaHref", label: "Link tombol", kind: "url" },
      { key: "image", label: "Gambar / background", kind: "image" },
    ],
    lists: [],
    defaults: {
      headline: "Judul Besar yang Menjual",
      subheadline: "Satu kalimat yang menjelaskan nilai utama bisnis Anda.",
      ctaText: "Hubungi Kami",
      ctaHref: "#kontak",
      image: "",
    },
  },
  {
    type: "pageheader",
    label: "Judul Halaman",
    hint: "Banner ringkas untuk bagian atas halaman dalam.",
    fields: [
      { key: "title", label: "Judul", kind: "text" },
      { key: "subtitle", label: "Sub-judul", kind: "textarea" },
    ],
    lists: [],
    defaults: { title: "Judul Halaman", subtitle: "Deskripsi singkat halaman ini." },
  },
  {
    type: "features",
    label: "Fitur / Keunggulan",
    hint: "Tiga kolom keunggulan.",
    fields: [{ key: "title", label: "Judul bagian", kind: "text" }],
    lists: [
      {
        key: "items",
        label: "Item keunggulan",
        itemLabel: "Keunggulan",
        itemFields: [
          { key: "title", label: "Judul", kind: "text" },
          { key: "text", label: "Deskripsi", kind: "textarea" },
        ],
        itemDefault: { title: "Keunggulan", text: "Penjelasan singkat." },
      },
    ],
    defaults: {
      title: "Kenapa Memilih Kami",
      items: [
        { title: "Cepat", text: "Proses kilat tanpa ribet." },
        { title: "Terpercaya", text: "Ratusan pelanggan puas." },
        { title: "Terjangkau", text: "Harga bersahabat, kualitas premium." },
      ],
    },
  },
  {
    type: "about",
    label: "Tentang",
    hint: "Cerita brand + gambar.",
    fields: [
      { key: "title", label: "Judul", kind: "text" },
      { key: "text", label: "Isi", kind: "textarea" },
      { key: "image", label: "Gambar", kind: "image" },
    ],
    lists: [],
    defaults: {
      title: "Tentang Kami",
      text: "Ceritakan siapa Anda, misi, dan apa yang membuat brand ini berbeda.",
      image: "",
    },
  },
  {
    type: "products",
    label: "Produk / Layanan",
    hint: "Grid produk/layanan dengan gambar & harga.",
    fields: [{ key: "title", label: "Judul bagian", kind: "text" }],
    lists: [
      {
        key: "items",
        label: "Item",
        itemLabel: "Item",
        itemFields: [
          { key: "name", label: "Nama", kind: "text" },
          { key: "price", label: "Harga", kind: "text" },
          { key: "desc", label: "Deskripsi", kind: "textarea" },
          { key: "image", label: "Gambar", kind: "image" },
        ],
        itemDefault: { name: "Produk", price: "Rp 0", desc: "", image: "" },
      },
    ],
    defaults: {
      title: "Produk Unggulan",
      items: [
        { name: "Produk A", price: "Rp 99.000", desc: "", image: "" },
        { name: "Produk B", price: "Rp 149.000", desc: "", image: "" },
        { name: "Produk C", price: "Rp 199.000", desc: "", image: "" },
      ],
    },
  },
  {
    type: "testimonial",
    label: "Testimoni",
    hint: "Kutipan pelanggan.",
    fields: [
      { key: "quote", label: "Kutipan", kind: "textarea" },
      { key: "author", label: "Nama pelanggan", kind: "text" },
    ],
    lists: [],
    defaults: {
      quote: "“Pelayanannya luar biasa, hasilnya melebihi ekspektasi!”",
      author: "Budi, Jakarta",
    },
  },
  {
    type: "faq",
    label: "FAQ",
    hint: "Daftar pertanyaan & jawaban (accordion).",
    fields: [{ key: "title", label: "Judul bagian", kind: "text" }],
    lists: [
      {
        key: "items",
        label: "Pertanyaan",
        itemLabel: "Pertanyaan",
        itemFields: [
          { key: "q", label: "Pertanyaan", kind: "text" },
          { key: "a", label: "Jawaban", kind: "textarea" },
        ],
        itemDefault: { q: "Pertanyaan?", a: "Jawaban singkat." },
      },
    ],
    defaults: {
      title: "Pertanyaan yang Sering Diajukan",
      items: [
        { q: "Bagaimana cara memesan?", a: "Cukup hubungi kami via WhatsApp." },
        { q: "Apakah bisa diantar?", a: "Bisa, tergantung area pengiriman." },
      ],
    },
  },
  {
    type: "posts",
    label: "Blog / Artikel",
    hint: "Daftar artikel blog (kartu → halaman artikel).",
    fields: [{ key: "title", label: "Judul bagian", kind: "text" }],
    lists: [
      {
        key: "items",
        label: "Artikel",
        itemLabel: "Artikel",
        itemFields: [
          { key: "title", label: "Judul", kind: "text" },
          { key: "date", label: "Tanggal", kind: "text" },
          { key: "cover", label: "Gambar sampul", kind: "image" },
          { key: "excerpt", label: "Ringkasan", kind: "textarea" },
          { key: "body", label: "Isi artikel (## judul, - poin, baris kosong = paragraf)", kind: "textarea" },
        ],
        itemDefault: { title: "Judul Artikel", date: "2026", cover: "", excerpt: "Ringkasan singkat.", body: "Paragraf pembuka artikel." },
      },
    ],
    defaults: { title: "", items: [] },
  },
  {
    type: "cta",
    label: "Call To Action",
    hint: "Ajakan bertindak + tombol.",
    fields: [
      { key: "headline", label: "Headline", kind: "text" },
      { key: "text", label: "Sub-teks", kind: "textarea" },
      { key: "buttonText", label: "Teks tombol", kind: "text" },
      { key: "buttonHref", label: "Link tombol", kind: "url" },
    ],
    lists: [],
    defaults: {
      headline: "Siap Memulai?",
      text: "Hubungi kami sekarang dan dapatkan penawaran terbaik.",
      buttonText: "Chat WhatsApp",
      buttonHref: "https://wa.me/62",
    },
  },
  {
    type: "contact",
    label: "Kontak",
    hint: "Info kontak & lokasi.",
    fields: [
      { key: "title", label: "Judul", kind: "text" },
      { key: "whatsapp", label: "WhatsApp", kind: "text" },
      { key: "email", label: "Email", kind: "text" },
      { key: "address", label: "Alamat", kind: "textarea" },
      { key: "hours", label: "Jam operasional", kind: "text" },
    ],
    lists: [],
    defaults: {
      title: "Hubungi Kami",
      whatsapp: "+62 812-0000-0000",
      email: "halo@brand.com",
      address: "Jl. Contoh No. 1, Jakarta",
      hours: "Senin - Sabtu, 09.00 - 18.00",
    },
  },
  {
    type: "footer",
    label: "Footer",
    hint: "Bagian penutup (biasanya otomatis).",
    fields: [{ key: "text", label: "Teks footer", kind: "text" }],
    lists: [],
    defaults: { text: "© 2026 Brand Anda. Dibuat dengan ScaleUp." },
  },
];

export function blockDef(type: WebBlockType): BlockDef | undefined {
  return BLOCK_DEFS.find((b) => b.type === type);
}

function genId(prefix = "b"): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}_${Math.round(Math.random() * 1e9)}`;
}

export function newBlock(type: WebBlockType): WebBlock {
  const def = blockDef(type);
  return { id: genId(), type, props: JSON.parse(JSON.stringify(def?.defaults ?? {})) };
}

export function newPage(slug: string, name: string, blocks: WebBlock[]): Page {
  return { id: genId("p"), slug, name, blocks };
}

/** Slug for a blog post derived from its title. */
export function postSlug(title: string): string {
  return (title || "artikel")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "artikel";
}

export function defaultDoc(brand: string): WebsiteDoc {
  return {
    theme: { primary: "#FF5733", brand, logo: "", whatsapp: "+62 812-0000-0000" },
    pages: [
      newPage("", "Home", [newBlock("hero"), newBlock("features"), newBlock("cta")]),
      newPage("produk", "Produk", [newBlock("pageheader"), newBlock("products"), newBlock("cta")]),
      newPage("faq", "FAQ", [newBlock("pageheader"), newBlock("faq")]),
      newPage("blog", "Blog", [newBlock("pageheader"), newBlock("posts")]),
      newPage("kontak", "Kontak", [newBlock("pageheader"), newBlock("contact")]),
    ],
  };
}

function normalizeBlocks(raw: unknown): WebBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b) => b && b.type && blockDef(b.type as WebBlockType))
    .map((b) => ({
      id: typeof b.id === "string" && b.id ? b.id : genId(),
      type: b.type as WebBlockType,
      props: b.props && typeof b.props === "object" && !Array.isArray(b.props) ? (b.props as Record<string, unknown>) : {},
    }));
}

export function coerceDoc(data: unknown, brand: string): WebsiteDoc {
  const d = (data ?? {}) as Record<string, unknown>;
  const theme = (d.theme ?? {}) as Partial<WebsiteTheme>;
  const themeOut: WebsiteTheme = {
    primary: theme.primary || "#FF5733",
    brand: theme.brand || brand,
    logo: theme.logo || "",
    whatsapp: theme.whatsapp || "+62 812-0000-0000",
  };

  // New multi-page format.
  if (Array.isArray(d.pages) && d.pages.length > 0) {
    const pages: Page[] = (d.pages as Record<string, unknown>[]).map((p) => ({
      id: typeof p.id === "string" && p.id ? p.id : genId("p"),
      slug: typeof p.slug === "string" ? p.slug : "",
      name: typeof p.name === "string" && p.name ? p.name : "Halaman",
      blocks: normalizeBlocks(p.blocks),
    }));
    return { theme: themeOut, pages };
  }

  // Legacy single-page format ({ blocks }) → migrate into a Home page.
  if (Array.isArray(d.blocks) && d.blocks.length > 0) {
    return {
      theme: themeOut,
      pages: [newPage("", "Home", normalizeBlocks(d.blocks))],
    };
  }

  return defaultDoc(brand);
}

export function getPage(doc: WebsiteDoc, slug: string): Page | undefined {
  return doc.pages.find((p) => p.slug === slug);
}
