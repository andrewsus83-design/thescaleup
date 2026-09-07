import type { BuilderConfig } from "@/lib/builders/wizard-types";

// Per-builder wizard configs are registered here (designed by the specialist
// agents; see lib/builders/configs/<slug>.ts).
import { website } from "./website";
import { store } from "./store";
import { content } from "./content";
import { ads } from "./ads";
import { opportunity } from "./opportunity";
import { crm } from "./crm";
import { tasks } from "./tasks";

export const BUILDER_CONFIGS: Record<string, BuilderConfig> = {
  website,
  store,
  content,
  ads,
  opportunity,
  crm,
  tasks,
};

export function getBuilderConfig(slug: string): BuilderConfig | undefined {
  return BUILDER_CONFIGS[slug];
}
