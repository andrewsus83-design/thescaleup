import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** The Claude model the hub's AI helpers use. HUB_AI_MODEL changes it without a code change. */
export const aiModel = () => process.env.HUB_AI_MODEL?.trim() || "claude-sonnet-5-5";

/** One plain request with no tools. Returns the text and how many tokens it used. */
export async function askClaude(apiKey: string, system: string, user: string, maxTokens: number) {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({ model: aiModel(), max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }, { timeout: 60_000 });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, tokens: { in: resp.usage?.input_tokens ?? 0, out: resp.usage?.output_tokens ?? 0 } };
}
