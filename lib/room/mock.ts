// Mock data for the Chat Room prototype. Fictional brands; nothing here is read from or written to a database.

import type { Asset, ChronicleEntry, KnowledgeItem, Message, Project, ReportData, Todo } from "./types";

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TODOS: Record<string, Todo[]> = {};

export const INITIAL_CHRONICLE: Record<string, ChronicleEntry[]> = {};

export const INITIAL_ASSETS: Record<string, Asset[]> = {};

export const INITIAL_KNOWLEDGE: KnowledgeItem[] = [];

export const REPORTS: Record<string, ReportData> = {};

/** What a freshly finished audit looks like (stand-in for the real pipeline's output). */
export function nextReport(projectName: string, prev?: ReportData): ReportData {
  if (prev) {
    return {
      ...prev,
      audit: prev.audit + 1,
      date: "Just now",
      score: Math.min(100, prev.score + 3),
      scorecard: prev.scorecard.map((s) => (s.self ? { ...s, must: Math.min(100, s.must + 3), nice: Math.min(100, s.nice + 2) } : s)),
    };
  }
  return {
    audit: 1,
    date: "Just now",
    score: 52,
    scorecard: [
      { name: projectName, self: true, must: 52, nice: 40, try: 25, coverage: 0.7 },
      { name: "Competitor A", must: 74, nice: 60, try: 44, coverage: 0.9 },
      { name: "Competitor B", must: 61, nice: 48, try: 33, coverage: 0.8 },
    ],
    insights: [
      { id: "n1", priority: 1, title: "No FAQ page — AI answers cannot quote you", evidence: "Crawled 9 URLs: none matched /faq or carried FAQPage schema." },
      { id: "n2", priority: 2, title: "No LocalBusiness schema on the homepage", evidence: "No JSON-LD found on the homepage." },
      { id: "n3", priority: 3, title: "Instagram bio does not link to the website", evidence: "The bio link field is empty." },
    ],
  };
}

/** The first audit turns its insights into a Week 1 plan: each item names the failed check, the tip and the service. */
export function todosFromReport(report: ReportData, mkId: () => string): Todo[] {
  return report.insights.map((i) => ({
    id: mkId(),
    title: i.title.split(" — ")[0],
    group: "week1" as const,
    check: i.title,
    tip: i.evidence,
    service: i.priority === 3 ? "Content builder · profile copy" : "Web builder · page or schema",
    status: "progress" as const,
  }));
}

export const SEED_THREADS: Record<string, Message[]> = {};

export const RECENT_THREADS: Record<string, string[]> = {};
