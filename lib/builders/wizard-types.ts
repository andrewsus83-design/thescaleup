export type BuilderFieldType =
  | "text"
  | "textarea"
  | "url"
  | "color"
  | "image"
  | "select"
  | "radio"
  | "cards"
  | "multiselect"
  | "toggle"
  | "stages"
  | "taglist"
  | "sourcelinks"
  | "info";

export type BuilderField = {
  type: BuilderFieldType;
  key?: string;
  label: string;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string; desc?: string }[];
};

export type BuilderStep = {
  title: string;
  subtitle?: string;
  /** true = ScaleUp handles this automatically; shown as info, no input needed. */
  auto?: boolean;
  fields: BuilderField[];
};

export type BuilderConfig = {
  slug: string;
  title: string;
  persona?: string;
  steps: BuilderStep[];
  suggestions?: string[];
};
