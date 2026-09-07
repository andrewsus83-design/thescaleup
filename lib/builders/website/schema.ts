// Shared schema for the visual website builder. Used by the editor (canvas +
// inspector) and the public renderer at /site/[memberId]. Plain module — safe
// to import from both server and client.

export type WebBlockType =
  | "hero"
  | "features"
  | "about"
  | "products"
  | "testimonial"
  | "cta"
  | "contact"
  | "footer";

export type WebBlock = {
  id: string;
  type: WebBlockType;
  props: Record<string, unknown>;
};

export type WebsiteTheme = {
  primary: string;
  brand: string;
  logo?: string;
};

export type WebsiteDoc = {
  theme: WebsiteTheme;
  blocks: WebBlock[];
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
    hint: "Bagian pembuka besar dengan headline & tombol utama.",
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
    type: "features",
    label: "Fitur / Keunggulan",
    hint: "Tiga kolom keunggulan produk atau layanan.",
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
    hint: "Cerita brand + gambar pendukung.",
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
    label: "Produk / Katalog",
    hint: "Grid produk dengan gambar & harga.",
    fields: [{ key: "title", label: "Judul bagian", kind: "text" }],
    lists: [
      {
        key: "items",
        label: "Produk",
        itemLabel: "Produk",
        itemFields: [
          { key: "name", label: "Nama", kind: "text" },
          { key: "price", label: "Harga", kind: "text" },
          { key: "image", label: "Gambar", kind: "image" },
        ],
        itemDefault: { name: "Produk", price: "Rp 0", image: "" },
      },
    ],
    defaults: {
      title: "Produk Unggulan",
      items: [
        { name: "Produk A", price: "Rp 99.000", image: "" },
        { name: "Produk B", price: "Rp 149.000", image: "" },
        { name: "Produk C", price: "Rp 199.000", image: "" },
      ],
    },
  },
  {
    type: "testimonial",
    label: "Testimoni",
    hint: "Kutipan pelanggan untuk membangun kepercayaan.",
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
    type: "cta",
    label: "Call To Action",
    hint: "Ajakan bertindak dengan tombol.",
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
    ],
    lists: [],
    defaults: {
      title: "Hubungi Kami",
      whatsapp: "+62 812-0000-0000",
      email: "halo@brand.com",
      address: "Jl. Contoh No. 1, Jakarta",
    },
  },
  {
    type: "footer",
    label: "Footer",
    hint: "Bagian penutup halaman.",
    fields: [{ key: "text", label: "Teks footer", kind: "text" }],
    lists: [],
    defaults: { text: "© 2026 Brand Anda. Dibuat dengan ScaleUp." },
  },
];

export function blockDef(type: WebBlockType): BlockDef | undefined {
  return BLOCK_DEFS.find((b) => b.type === type);
}

export function newBlock(type: WebBlockType): WebBlock {
  const def = blockDef(type);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `b_${Math.round(Math.random() * 1e9)}`;
  return { id, type, props: JSON.parse(JSON.stringify(def?.defaults ?? {})) };
}

export function defaultDoc(brand: string): WebsiteDoc {
  return {
    theme: { primary: "#FF5733", brand, logo: "" },
    blocks: [newBlock("hero"), newBlock("features"), newBlock("cta")],
  };
}

export function coerceDoc(data: unknown, brand: string): WebsiteDoc {
  const d = (data ?? {}) as Partial<WebsiteDoc>;
  if (!Array.isArray(d.blocks) || d.blocks.length === 0) return defaultDoc(brand);
  return {
    theme: {
      primary: d.theme?.primary || "#FF5733",
      brand: d.theme?.brand || brand,
      logo: d.theme?.logo || "",
    },
    blocks: d.blocks.filter((b) => b && b.type && blockDef(b.type as WebBlockType)),
  };
}
