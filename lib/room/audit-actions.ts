"use server";
import { runAudit } from "@/lib/engine/audit";
import type { Profile } from "./types";

export type RoomAuditPayload = {
  ok: true;
  score: number;
  summary: string;
  scorecard: { name: string; coverage: number }[];
  missing: string[];
  opportunities: string[];
};

export type RoomAuditError = { ok: false; error: string };
export type RoomAuditResult = RoomAuditPayload | RoomAuditError;

export async function runRoomAudit(
  brandDbId: string | undefined,
  projectName: string,
  profile: Profile,
): Promise<RoomAuditResult> {
  const business = profile.brand ?? projectName;
  const m: Record<string, unknown> = {
    business,
    website: profile.website ?? undefined,
    category: profile.what ?? undefined,
    goal: profile.why ?? undefined,
    budget: undefined,
    bottleneck: undefined,
    instagram: profile.handles?.[0] ?? undefined,
    tiktok: undefined,
    competitor1: undefined,
    competitor2: undefined,
  };

  const result = await runAudit(m, brandDbId);

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Audit failed" };
  }

  const c = result.content ?? {};
  const scores = (c.scores as Record<string, number>) ?? {};

  return {
    ok: true,
    score: scores.overall ?? 50,
    summary: (result.summary as string) ?? "",
    scorecard: [
      { name: "Website & CRO",   coverage: scores.cro    ?? 0 },
      { name: "GEO / AI Search", coverage: scores.geo    ?? 0 },
      { name: "Social Media",    coverage: scores.social ?? 0 },
      { name: "Tech & Speed",    coverage: scores.tech   ?? 0 },
    ],
    missing:       ((c.whats_missing   as string[]) ?? []).slice(0, 5),
    opportunities: ((c.opportunities   as string[]) ?? []).slice(0, 3),
  };
}
