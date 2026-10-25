"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { question, resumeIntake, startIntake } from "@/lib/room/intake";
import type { Message, Project } from "@/lib/room/types";
import { useRoom } from "../room-provider";

/** Start the guided intake for a new brand, or resume an unfinished draft where it stopped. */
export function useIntakeStarter() {
  const { setIntake, href, uid } = useRoom();
  const router = useRouter();
  return useCallback(
    (draft?: Project) => {
      const s = draft ? resumeIntake(draft) : startIntake();
      const log: Message[] = [
        {
          id: uid(),
          role: "assistant",
          text: draft
            ? `Welcome back — resuming the draft for “${draft.name}”. I'll only ask about what's still missing.`
            : "Let's set up a new brand. I'll ask one question at a time — seven at most — and read the website to fill in what it already says.",
        },
        { id: uid(), role: "assistant", text: question(s, "en") },
      ];
      setIntake(s, log);
      router.push(href("/chat"));
    },
    [setIntake, href, uid, router],
  );
}
