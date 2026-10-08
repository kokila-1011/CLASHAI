/**
 * orchestrator.js
 *
 * Drives the sequential multi-agent debate loop.
 *
 * Flow per round:
 *   Optimist → Skeptic → Fact-Checker → Moderator
 *
 * Each agent:
 *   1. Receives the full prior transcript as conversation history.
 *   2. Streams its response back token-by-token over SSE.
 *   3. Once complete, its full reply is appended to the shared history.
 *
 * Fact-Checker special handling (only this agent is affected):
 *   - A small Gemini call extracts a search query from the current transcript.
 *   - Tavily is called synchronously; results are injected into the prompt.
 *   - A `sources` SSE event is emitted so the frontend can render citations.
 *   - Any failure in the Tavily flow is swallowed — the agent still responds.
 *
 * The Moderator's reply is scanned for "CONCLUDE". If found the loop ends;
 * otherwise a new round begins (up to MAX_ROUNDS).
 *
 * SSE event shapes yielded by this generator:
 *   { type: "agent_start",  agentId, agentName }
 *   { type: "sources",      agentId, sources: [{title, url}] }   ← Fact-Checker only
 *   { type: "agent_chunk",  agentId, chunk }
 *   { type: "agent_end",    agentId }
 *   { type: "debate_end" }
 *   { type: "error",        message }
 */

import ollama from "ollama";
import { AGENTS } from "./agents.js";
import {
  extractSearchQuery,
  searchTavily,
  formatSourcesForPrompt,
} from "./services/tavily.js";

const MAX_ROUNDS = 1;
const MODEL = "llama3.2"; // 2GB model – smaller and faster than llama3 (4.7GB)

export async function* runDebate(decision) {

  // Shared conversation history – grows each turn.
  const history = [];

  // Seed with the user's decision as the opening message.
  history.push({
    role: "user",
    parts: [{ text: `The decision under debate is: "${decision}"` }],
  });

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    yield { type: "round_update", round, maxRounds: MAX_ROUNDS };
    let concludeDebate = false;

    for (const agent of AGENTS) {
      yield { type: "agent_start", agentId: agent.id, agentName: agent.name };

      let fullReply = "";

      // ── Fact-Checker: run Tavily before generating ────────────────────────
      let factCheckerSystemPrompt = agent.prompt;

      if (agent.id === "factchecker") {
        const tavilyKey = process.env.TAVILY_API_KEY;

        try {
          const query = await extractSearchQuery(history);
          console.log(`[tavily] searching for: "${query}"`);

          const results = await searchTavily(query, tavilyKey);
          console.log(`[tavily] got ${results.length} result(s)`);

          // Emit sources event BEFORE the agent starts speaking so the UI
          // can show the source list as soon as the bubble appears.
          const sourceSummaries = results.map(({ title, url }) => ({ title, url }));
          yield { type: "sources", agentId: agent.id, sources: sourceSummaries };

          // Inject results into the system prompt as grounding context.
          const sourcesBlock = formatSourcesForPrompt(results);
          if (sourcesBlock) {
            factCheckerSystemPrompt = `${agent.prompt}\n\n${sourcesBlock}`;
          }
        } catch (err) {
          // Unexpected error — log and continue without sources.
          console.warn("[tavily] unexpected error during fact-check prep:", err.message);
          yield { type: "sources", agentId: agent.id, sources: [] };
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      let streamSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Format Gemini-style history to Ollama-style messages
          const ollamaMessages = [
            { role: "system", content: factCheckerSystemPrompt },
            ...history.map(h => ({
              role: h.role === "model" ? "assistant" : "user",
              content: h.parts[0].text
            })),
            { role: "user", content: "Your turn." }
          ];

          const streamPromise = ollama.chat({
            model: MODEL,
            messages: ollamaMessages,
            stream: true,
          });

          // Timeout increased to 30s to handle slower responses
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Ollama API timeout")), 30000)
          );
          
          const stream = await Promise.race([streamPromise, timeoutPromise]);

          // Buffer the full reply first for Moderator (to strip JSON), stream directly for others
          if (agent.id === "moderator") {
            for await (const chunk of stream) {
              const text = chunk.message?.content ?? "";
              if (text) fullReply += text;
            }
            // Strip trailing JSON consensus block before showing to user
            const cleanReply = fullReply
              .replace(/\{\s*"consensus"\s*:\s*(true|false)\s*\}\s*$/i, "")
              .trim();
            yield { type: "agent_chunk", agentId: agent.id, chunk: cleanReply };
          } else {
            for await (const chunk of stream) {
              const text = chunk.message?.content ?? "";
              if (text) {
                fullReply += text;
                yield { type: "agent_chunk", agentId: agent.id, chunk: text };
              }
            }
          }
          streamSuccess = true;
          break; // Success, exit retry loop
        } catch (err) {
          console.warn(`[orchestrator] Ollama attempt ${attempt} failed for ${agent.name}:`, err.message);

          if (attempt < 3) {
            console.log(`[orchestrator] Waiting 2s before retry ${attempt + 1}...`);
            await new Promise(r => setTimeout(r, 2000));
            fullReply = ""; // Reset for retry
          } else {
            throw err;
          }
        }
      }

      if (!streamSuccess) {
        // Only happens if stream somehow completes but streamSuccess wasn't set, fallback just in case
        const fallbackMsg = `*(Network timeout: ${agent.name} could not respond this round)*`;
        fullReply = fallbackMsg;
        yield { type: "agent_chunk", agentId: agent.id, chunk: fallbackMsg };
      }

      yield { type: "agent_end", agentId: agent.id };

      // Artificial 1.5s gap between agent turns to pace the debate and avoid hitting rate limits instantly
      await new Promise(r => setTimeout(r, 1500));

      // Append this agent's reply to shared history.
      history.push({
        role: "user",
        parts: [{ text: `[${agent.name}]: ${fullReply}` }],
      });

      // Let the Moderator decide whether to conclude based on the consensus JSON flag.
      if (agent.id === "moderator") {
        try {
          // Extract the last line of the fullReply, which should be the JSON block
          const lines = fullReply.trim().split("\n");
          const lastLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastLine);
          
          if (parsed && typeof parsed.consensus === "boolean") {
            concludeDebate = parsed.consensus;
          }
        } catch (e) {
          console.warn("[orchestrator] Could not parse consensus flag from moderator:", fullReply);
          // Default to false (continue debate) if parsing fails.
        }
      }
    }

    if (concludeDebate) break;
  }

  // ── Final Verdict Synthesis ───────────────────────────────────────────────

  const verdictPrompt = `You are a neutral AI synthesizer. A debate has just concluded.
Summarize the strongest arguments from each side and give a final recommendation.
Assign a confidenceScore from 0 to 100 (how clear-cut the answer is).
Respond ONLY with a JSON object — no extra text, no markdown.
Schema: { "verdict": "...", "reasoning": "...", "confidenceScore": 75 }`;

  let verdictData = null;

  /**
   * Attempt to get a valid verdict JSON from Ollama.
   * Uses format:"json" to force structured output (Ollama grammar sampling).
   * Falls back to regex extraction if the raw text still has JSON buried in it.
   */
  const generateVerdict = async () => {
    const ollamaMessages = [
      { role: "system", content: verdictPrompt },
      ...history.map(h => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.parts[0].text
      })),
      { role: "user", content: "Provide the final verdict JSON now." }
    ];

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Verdict timeout")), 90000)
    );

    const resultPromise = ollama.chat({
      model: MODEL,
      messages: ollamaMessages,
      format: "json",          // ← forces Ollama to grammar-sample valid JSON
      options: { temperature: 0.1 },
    });

    const result = await Promise.race([resultPromise, timeoutPromise]);
    let text = (result.message?.content || "").trim();

    // 1st try: direct parse (format:"json" should make this always succeed)
    try {
      return JSON.parse(text);
    } catch (_) {}

    // 2nd try: strip markdown fences then parse
    text = text.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
    try {
      return JSON.parse(text);
    } catch (_) {}

    // 3rd try: the model output valid JSON but forgot the closing } — append it and retry
    if (text.startsWith("{") && !text.endsWith("}")) {
      try { return JSON.parse(text + "}"); } catch (_) {}
    }

    // 4th try: grab first complete {...} block anywhere in the text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_) {}
    }

    // 5th try: grab {...} and try appending closing brace
    const partialMatch = text.match(/\{[\s\S]*/);
    if (partialMatch) {
      try { return JSON.parse(partialMatch[0] + "}"); } catch (_) {}
    }

    // 4th try: build a verdict from the raw text so the user still sees something useful
    console.warn("[orchestrator] All JSON parse attempts failed, using raw text fallback. Raw:", text);
    return {
      verdict: text.slice(0, 200) || "The debate concluded without a clear winner.",
      reasoning: text.slice(200) || "See verdict above.",
      confidenceScore: 50,
    };
  };

  try {
    verdictData = await generateVerdict();

    yield {
      type: "verdict",
      payload: {
        verdict: verdictData.verdict || "No verdict provided.",
        reasoning: verdictData.reasoning || "No reasoning provided.",
        confidenceScore: typeof verdictData.confidenceScore === "number"
          ? verdictData.confidenceScore
          : null,
      },
    };
  } catch (err) {
    console.error("[orchestrator] Verdict synthesis failed:", err.message);
    yield { type: "error", message: "Failed to synthesize verdict: " + err.message };
  }
  
  yield { type: "debate_end" };
}
