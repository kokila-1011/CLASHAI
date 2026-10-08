/**
 * tavily.js — Thin wrapper around the Tavily Search API.
 *
 * Docs: https://docs.tavily.com/docs/rest-api/api-reference
 *
 * Exported:
 *   extractSearchQuery(history, genai) → string
 *     Uses a tiny Gemini call to derive a search-friendly query from the
 *     debate transcript so far.  Falls back to a simple heuristic if the
 *     call fails.
 *
 *   searchTavily(query, apiKey) → Array<{ title, url, content }>
 *     Calls Tavily and returns the top results (max 3).
 *     Returns [] on any failure so the caller can degrade gracefully.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_RESULTS = 3;

// ── Query extraction ──────────────────────────────────────────────────────────

/**
 * Ask Gemini to distil the current debate history into a short, search-
 * friendly query string (≤ 10 words).  Falls back to a heuristic if
 * the Gemini call throws.
 *
 * @param {Array<{role,parts}>} history   shared debate history so far
 * @param {GoogleGenAI}         genai     already-initialised Gemini client
 * @param {string}              model     model ID to use
 * @returns {Promise<string>}
 */
export async function extractSearchQuery(history, genai, model) {
  // Build a compact transcript (last ~4 turns is enough).
  const recentTurns = history.slice(-4);
  const transcript = recentTurns
    .map((h) => h.parts.map((p) => p.text).join(" "))
    .join("\n");

  const extractPrompt =
    `You are a research assistant. Read the following debate excerpt and output ` +
    `ONE short web-search query (10 words max, no quotes) that would let a ` +
    `fact-checker verify the most important factual claim being made.\n\n` +
    `Debate excerpt:\n${transcript}\n\nSearch query:`;

  try {
    const result = await genai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: extractPrompt }] }],
      config: { maxOutputTokens: 30, temperature: 0.2 },
    });
    const raw = result.text?.trim() ?? "";
    // Strip surrounding quotes if Gemini added them.
    return raw.replace(/^["']|["']$/g, "").trim() || heuristicQuery(history);
  } catch (err) {
    console.warn("[tavily] extractSearchQuery Gemini call failed:", err.message);
    return heuristicQuery(history);
  }
}

/**
 * Simple heuristic fallback: pull the first user message (decision) and
 * trim it down to the first 10 words.
 */
function heuristicQuery(history) {
  const firstUser = history.find((h) => h.role === "user");
  const text = firstUser?.parts?.[0]?.text ?? "decision analysis";
  return text.split(/\s+/).slice(0, 10).join(" ");
}

// ── Tavily search ─────────────────────────────────────────────────────────────

/**
 * Call the Tavily Search API.
 *
 * @param {string} query
 * @param {string} apiKey  TAVILY_API_KEY
 * @returns {Promise<Array<{ title: string, url: string, content: string }>>}
 *   Empty array on any error so the orchestrator can degrade gracefully.
 */
export async function searchTavily(query, apiKey) {
  if (!apiKey) {
    console.warn("[tavily] TAVILY_API_KEY not set — skipping web search.");
    return [];
  }

  const fetchWithTimeout = async () => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
    try {
      const response = await fetch(TAVILY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          max_results: MAX_RESULTS,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetchWithTimeout();

      if (!response.ok) {
        const body = await response.text();
        console.warn(`[tavily] API returned ${response.status}: ${body}`);
        if (attempt === 1) continue; // retry on failure
        return [];
      }

      const data = await response.json();
      return (data.results ?? []).slice(0, MAX_RESULTS).map((r) => ({
        title: r.title ?? "Untitled",
        url: r.url ?? "",
        content: (r.content ?? "").slice(0, 400),
      }));
    } catch (err) {
      console.warn(`[tavily] attempt ${attempt} failed:`, err.message);
      if (attempt === 2) return [];
    }
  }
  return [];
}

/**
 * Format Tavily results as a compact block to inject into a system prompt.
 *
 * @param {Array<{ title, url, content }>} results
 * @returns {string}
 */
export function formatSourcesForPrompt(results) {
  if (!results.length) return "";
  return (
    "VERIFIED WEB SOURCES (use these to ground your analysis):\n" +
    results
      .map(
        (r, i) =>
          `[${i + 1}] "${r.title}" — ${r.url}\n    Snippet: ${r.content}`
      )
      .join("\n\n")
  );
}
