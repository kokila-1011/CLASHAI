/**
 * useDebateStream.js
 *
 * Custom hook that manages the SSE connection to POST /api/debate.
 *
 * Because EventSource doesn't support POST bodies we use fetch() with a
 * ReadableStream reader, manually parsing the "data: ...\n\n" SSE frames.
 *
 * Returns:
 *   messages    : Array<{
 *                   id         : string,
 *                   agentId    : string,
 *                   text       : string,
 *                   isStreaming: boolean,
 *                   sources?   : Array<{ title: string, url: string }>
 *                 }>
 *   verdict     : { verdict: string, reasoning: string, confidenceScore: number | null } | null
 *   roundInfo   : { current: number, max: number } | null
 *   isLoading   : boolean
 *   error       : string | null
 *   startDebate : (decision: string) => void
 *   resetDebate : () => void
 */

import { useState, useRef, useCallback } from "react";

const SERVER_URL = "http://localhost:3001";

export function useDebateStream() {
  const [messages, setMessages] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [roundInfo, setRoundInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const resetDebate = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setVerdict(null);
    setRoundInfo(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const startDebate = useCallback(async (decision) => {
    resetDebate();
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${SERVER_URL}/api/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error ?? `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Parse raw SSE frames from the stream.
      const parseEvents = (raw) => {
        buffer += raw;
        const frames = buffer.split("\n\n");
        buffer = frames.pop(); // keep incomplete tail
        return frames
          .map((f) => f.replace(/^data: /, "").trim())
          .filter(Boolean)
          .map((f) => {
            try { return JSON.parse(f); }
            catch { return null; }
          })
          .filter(Boolean);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const events = parseEvents(decoder.decode(value, { stream: true }));

        for (const event of events) {
          handleEvent(event);
          if (event.type === "debate_end" || event.type === "error") {
            setIsLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [resetDebate]);

  // ── Event handler ──────────────────────────────────────────────────────────

  function handleEvent(event) {
    switch (event.type) {
      case "agent_start": {
        // Push a new empty bubble that will accumulate chunks.
        setMessages((prev) => [
          ...prev,
          {
            id: `${event.agentId}-${Date.now()}`,
            agentId: event.agentId,
            text: "",
            isStreaming: true,
          },
        ]);
        break;
      }

      case "agent_chunk": {
        // Append the chunk to the last bubble for this agent.
        setMessages((prev) => {
          const updated = [...prev];
          // Find the most recent bubble for this agent.
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].agentId === event.agentId && updated[i].isStreaming) {
              updated[i] = { ...updated[i], text: updated[i].text + event.chunk };
              break;
            }
          }
          return updated;
        });
        break;
      }

      case "agent_end": {
        // Seal the bubble — remove streaming cursor.
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].agentId === event.agentId && updated[i].isStreaming) {
              updated[i] = { ...updated[i], isStreaming: false };
              break;
            }
          }
          return updated;
        });
        break;
      }

      case "sources": {
        // Attach the sources array to the most recent bubble for this agent.
        // The sources event arrives right after agent_start, before any chunks,
        // so the bubble already exists but has no text yet.
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].agentId === event.agentId) {
              updated[i] = { ...updated[i], sources: event.sources ?? [] };
              break;
            }
          }
          return updated;
        });
        break;
      }

      case "verdict": {
        setVerdict(event.payload);
        break;
      }

      case "round_update": {
        setRoundInfo({ current: event.round, max: event.maxRounds });
        break;
      }

      case "error": {
        setError(event.message);
        break;
      }

      default:
        break;
    }
  }

  return { messages, verdict, roundInfo, isLoading, error, startDebate, resetDebate };
}
