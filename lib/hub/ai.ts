import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** The Claude model the hub's AI helpers use. HUB_AI_MODEL changes it without a code change. */
export const aiModel = () => process.env.HUB_AI_MODEL?.trim() || "claude-sonnet-5-5";

/** One plain request with no tools. Returns the text and how many tokens it used. */
export async function askClaude(apiKey: string, system: string, user: string, maxTokens: number, timeoutMs = 60_000) {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({ model: aiModel(), max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }, { timeout: timeoutMs });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, tokens: { in: resp.usage?.input_tokens ?? 0, out: resp.usage?.output_tokens ?? 0 } };
}

/**
 * A short back-and-forth with no tools. The caller sends the whole conversation each time and nothing is kept here, so a chat is
 * only ever as long as the page that holds it. `truncated` is true when the reply hit the token cap and was cut off.
 */
export async function askClaudeChat(apiKey: string, system: string, messages: { role: "user" | "assistant"; content: string }[], maxTokens: number, timeoutMs = 90_000) {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({ model: aiModel(), max_tokens: maxTokens, system, messages }, { timeout: timeoutMs });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, truncated: resp.stop_reason === "max_tokens", tokens: { in: resp.usage?.input_tokens ?? 0, out: resp.usage?.output_tokens ?? 0 } };
}

/** The Anthropic account behind the key cannot use web search (it is switched off for the organisation, or the key may not use it). */
export class SearchUnavailable extends Error {}

/**
 * One request in which Claude may search the public web. Only the web search tool is given: the model cannot open pages itself, run
 * code or call anything else. A long search can pause the turn; the turn is continued up to `rounds` times, never past `deadline`.
 */
export async function askClaudeSearching(
  apiKey: string,
  system: string,
  user: string,
  o: { maxTokens: number; maxSearches: number; blocked: readonly string[]; timeoutMs: number; deadline: number; rounds?: number },
) {
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  const texts: string[] = [];
  const total = { in: 0, out: 0, searches: 0 };
  for (let round = 0; round < (o.rounds ?? 3); round++) {
    const left = o.deadline - Date.now();
    if (left < 8_000) break;
    let resp: Anthropic.Message;
    try {
      resp = await client.messages.create(
        {
          model: aiModel(),
          max_tokens: o.maxTokens,
          system,
          messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: o.maxSearches, blocked_domains: [...o.blocked] }],
        },
        { timeout: Math.min(o.timeoutMs, left) },
      );
    } catch (e) {
      if (e instanceof Anthropic.APIError && (e.status === 400 || e.status === 403) && /web[ _-]?search/i.test(e.message)) throw new SearchUnavailable(e.message);
      throw e;
    }
    total.in += resp.usage?.input_tokens ?? 0;
    total.out += resp.usage?.output_tokens ?? 0;
    total.searches += resp.usage?.server_tool_use?.web_search_requests ?? 0;
    texts.push(
      resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n"),
    );
    if (resp.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: resp.content });
  }
  return { text: texts.join("\n"), tokens: { in: total.in, out: total.out }, searches: total.searches };
}
