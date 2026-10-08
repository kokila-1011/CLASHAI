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

import { GoogleGenAI } from "@google/genai";
import { AGENTS } from "./agents.js";
import {
  extractSearchQuery,
  searchTavily,
  formatSourcesForPrompt,
} from "./services/tavily.js";

const MAX_ROUNDS = 3;
const MODEL = "gemini-2.0-flash";

export async function* runDebate(decision, apiKey) {
  const genai = new GoogleGenAI({ apiKey });

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
          const query = await extractSearchQuery(history, genai, MODEL);
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
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const chat = genai.chats.create({
            model: MODEL,
            config: {
              systemInstruction: factCheckerSystemPrompt,
            },
            history: history.slice(),
          });

          // Timeout the start of the request (TTFT)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Gemini API timeout")), 15000)
          );
          const streamPromise = chat.sendMessageStream({ message: "Your turn." });
          
          const stream = await Promise.race([streamPromise, timeoutPromise]);

          for await (const chunk of stream) {
            const text = chunk.text ?? "";
            if (text) {
              fullReply += text;
              yield { type: "agent_chunk", agentId: agent.id, chunk: text };
            }
          }
          streamSuccess = true;
          break; // Success, exit retry loop
        } catch (err) {
          console.warn(`[orchestrator] Gemini attempt ${attempt} failed for ${agent.name}:`, err.message);
          if (attempt === 1) {
            fullReply = ""; // Reset for retry
          }
        }
      }

      if (!streamSuccess) {
        const fallbackMsg = `*(Network timeout: ${agent.name} could not respond this round)*`;
        fullReply = fallbackMsg;
        yield { type: "agent_chunk", agentId: agent.id, chunk: fallbackMsg };
      }

      yield { type: "agent_end", agentId: agent.id };

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
  yield { type: "agent_start", agentId: "synthesizer", agentName: "Synthesizer" }; // Optional: signals UI that synthesis is happening

  const verdictPrompt = `You are a neutral synthesizer. The debate has concluded.
Review the transcript and provide a final verdict.
Summarize the strongest points on each side, note any unresolved factual disputes, and output a final recommendation.
Assign a confidence score (0-100) reflecting how clear-cut the decision is.

You MUST respond with ONLY valid JSON and absolutely nothing else. No markdown fences, no preamble, no explanation.
Use exactly this schema:
{
  "verdict": "short summary of the final recommendation",
  "reasoning": "detailed explanation of why this verdict was reached, referencing the debate",
  "confidenceScore": 75
}`;

  let verdictData = null;
  const generateVerdict = async (strictPrompt = false) => {
    const promptToUse = strictPrompt 
      ? verdictPrompt + "\n\nCRITICAL: YOUR PREVIOUS OUTPUT WAS INVALID JSON. YOU MUST RETURN ONLY PURE JSON, NO MARKDOWN, NO TEXT."
      : verdictPrompt;

    const chat = genai.chats.create({
      model: MODEL,
      config: {
        systemInstruction: promptToUse,
        temperature: 0.2,
      },
      history: history.slice(), // Pass the entire debate history
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));
    const resultPromise = chat.sendMessage({ message: "Synthesize the debate and provide the final verdict." });
    const result = await Promise.race([resultPromise, timeoutPromise]);
    
    let text = result.response.text() || "";
    
    // Strip markdown fences if the model included them despite instructions
    text = text.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("[orchestrator] Failed to parse verdict JSON:", text);
      return null;
    }
  };

  try {
    verdictData = await generateVerdict(false);
    if (!verdictData) {
      console.log("[orchestrator] Retrying verdict generation with stricter prompt...");
      verdictData = await generateVerdict(true);
    }
    
    if (!verdictData) {
       // Fallback if parsing fails twice
       verdictData = {
         verdict: "Debate concluded, but the synthesis could not be properly formatted.",
         reasoning: "The AI synthesizer failed to return a valid JSON response after multiple attempts.",
         confidenceScore: null
       };
    }
    
    // Ensure the shape matches what the frontend expects
    yield {
      type: "verdict",
      payload: {
        verdict: verdictData.verdict || "No verdict provided.",
        reasoning: verdictData.reasoning || "No reasoning provided.",
        confidenceScore: typeof verdictData.confidenceScore === 'number' ? verdictData.confidenceScore : null
      }
    };
  } catch (err) {
    console.error("[orchestrator] Verdict synthesis failed:", err.message);
    yield { type: "error", message: "Failed to synthesize verdict: " + err.message };
  }
  
  yield { type: "agent_end", agentId: "synthesizer" };
  yield { type: "debate_end" };
}
