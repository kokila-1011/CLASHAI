/**
 * test-sse.mjs
 * Quick end-to-end test: streams /api/debate and prints each SSE event.
 * Run with: node test-sse.mjs
 * 
 * With a placeholder API key this will error after agent_start for Optimist,
 * but confirms the SSE framing, CORS, and event shapes are all correct.
 *
 * With a real GEMINI_API_KEY (and placeholder TAVILY_API_KEY) you should see:
 *   agent_start  optimist
 *   agent_chunk  optimist   (multiple)
 *   agent_end    optimist
 *   agent_start  skeptic
 *   ...
 *   agent_start  factchecker
 *   sources      factchecker  (sources: [] because TAVILY_API_KEY is placeholder)
 *   agent_chunk  factchecker  (multiple)
 *   agent_end    factchecker
 *   agent_start  moderator
 *   ...
 *   debate_end
 */

const response = await fetch("http://localhost:3001/api/debate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ decision: "Should I quit my job to start a startup?" }),
});

if (!response.ok) {
  const err = await response.json().catch(() => ({}));
  console.error("HTTP error:", response.status, err);
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let eventCount = 0;

console.log("── SSE stream opened ─────────────────────────────────");

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const frames = buffer.split("\n\n");
  buffer = frames.pop();

  for (const frame of frames) {
    const line = frame.replace(/^data: /, "").trim();
    if (!line) continue;
    try {
      const event = JSON.parse(line);
      eventCount++;

      if (event.type === "agent_chunk") {
        process.stdout.write(event.chunk);
      } else if (event.type === "round_update") {
        console.log(`\n\n[${eventCount}] 🔄 round_update  Round ${event.round} of ${event.maxRounds}`);
      } else if (event.type === "agent_start") {
        console.log(`\n\n[${eventCount}] ▶ agent_start  agentId=${event.agentId}`);
      } else if (event.type === "agent_end") {
        console.log(`\n[${eventCount}] ■ agent_end    agentId=${event.agentId}`);
      } else if (event.type === "sources") {
        console.log(`\n[${eventCount}] 📚 sources     agentId=${event.agentId}  count=${event.sources.length}`);
        event.sources.forEach((s, i) => console.log(`      [${i+1}] ${s.title} — ${s.url}`));
      } else if (event.type === "verdict") {
        console.log(`\n[${eventCount}] ⚖️ verdict       confidence=${event.payload.confidenceScore}`);
        console.log(`      Verdict: ${event.payload.verdict.slice(0, 100)}...`);
      } else if (event.type === "debate_end") {
        console.log(`\n\n[${eventCount}] ✅ debate_end`);
      } else if (event.type === "error") {
        console.error(`\n[${eventCount}] ❌ error: ${event.message.slice(0, 200)}`);
      }

      if (event.type === "debate_end" || event.type === "error") break;
    } catch {
      // malformed frame — skip
    }
  }
}

console.log("\n── stream closed ──────────────────────────────────────");
