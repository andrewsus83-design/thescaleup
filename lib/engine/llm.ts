import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ApiKeys } from "./keys";

export type LlmResult = { text: string; provider: string; model: string };

/**
 * Call whichever LLM has a configured key, preferring Claude. Returns raw text
 * (the caller extracts JSON). Throws "NO_LLM_KEY" if none is configured.
 */
export async function callLLM(
  keys: ApiKeys,
  system: string,
  user: string,
): Promise<LlmResult> {
  // 1. Claude (preferred)
  if (keys.claude) {
    const model = "claude-opus-5";
    const client = new Anthropic({ apiKey: keys.claude });
    const resp = await client.messages.create({
      model,
      max_tokens: 8000,
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return { text, provider: "claude", model };
  }

  // 2. OpenAI
  if (keys.openai) {
    const model = "gpt-4o";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.openai}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return {
      text: j.choices?.[0]?.message?.content ?? "",
      provider: "openai",
      model,
    };
  }

  // 3. Gemini
  if (keys.gemini) {
    const model = "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys.gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            maxOutputTokens: 4000,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const j = await res.json();
    const text = (j.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("\n");
    return { text, provider: "gemini", model };
  }

  throw new Error("NO_LLM_KEY");
}
