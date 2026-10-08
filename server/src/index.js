/**
 * index.js — Express entry point
 *
 * Routes:
 *   GET  /health          → liveness probe
 *   POST /api/debate      → opens an SSE stream and runs the debate loop
 *
 * SSE event format (newline-delimited):
 *   data: <JSON>\n\n
 *
 * JSON shapes (see orchestrator.js for full list):
 *   { type: "agent_start",  agentId, agentName }
 *   { type: "agent_chunk",  agentId, chunk }
 *   { type: "agent_end",    agentId }
 *   { type: "debate_end" }
 *   { type: "error",        message }
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { runDebate } from "./orchestrator.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: "http://localhost:5173" })); // Vite default port
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

/**
 * POST /api/debate
 * Body: { decision: string }
 * Opens a persistent SSE stream and runs the multi-agent debate.
 */
app.post("/api/debate", async (req, res) => {
  const { decision } = req.body;

  if (!decision || typeof decision !== "string" || !decision.trim()) {
    return res.status(400).json({ error: "Missing or empty `decision` in request body." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
  }

  // ── SSE headers ────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering if proxied
  res.flushHeaders();

  // Helper to send a single SSE data frame.
  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    for await (const event of runDebate(decision.trim(), apiKey)) {
      send(event);
      if (event.type === "debate_end" || event.type === "error") break;
    }
  } catch (err) {
    send({ type: "error", message: err.message });
  } finally {
    res.end();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`ClashAI server running on http://localhost:${PORT}`);
});
