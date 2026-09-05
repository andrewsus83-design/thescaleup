import "server-only";

/**
 * Optional GEO / AI-Search check via Perplexity: does the AI recommend this
 * brand when a buyer asks for the category? Returns null on any failure.
 */
export async function perplexityGeoCheck(
  apiKey: string,
  brand: string,
  category: string,
): Promise<string | null> {
  const q = `Saat calon pembeli mencari "${category}" dan bertanya rekomendasi terbaik, sebutkan brand/nama yang paling sering direkomendasikan. Apakah "${brand}" termasuk yang direkomendasikan? Jawab ringkas dan jujur; jika brand tidak dikenal, katakan demikian.`;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: q }],
        max_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
