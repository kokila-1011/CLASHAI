/**
 * agentConfig.js
 *
 * Mirrors the visual properties from the server's agents.js so the frontend
 * can colour-code bubbles without a separate API call.
 *
 * Extend this map whenever you add a new persona on the server.
 */

export const AGENT_CONFIG = {
  optimist: {
    name: "Optimist",
    emoji: "🌟",
    bubble: "bg-emerald-50 border-emerald-200",
    label: "text-emerald-800",
  },
  skeptic: {
    name: "Skeptic",
    emoji: "🔍",
    bubble: "bg-rose-50 border-rose-200",
    label: "text-rose-800",
  },
  factchecker: {
    name: "Fact-Checker",
    emoji: "📊",
    bubble: "bg-sky-50 border-sky-200",
    label: "text-sky-800",
  },
  moderator: {
    name: "Moderator",
    emoji: "⚖️",
    bubble: "bg-violet-50 border-violet-200",
    label: "text-violet-800",
  },
};

export const DEFAULT_CONFIG = {
  name: "Agent",
  emoji: "🤖",
  bubble: "bg-gray-50 border-gray-200",
  label: "text-gray-800",
};
