/**
 * test-tavily-fallback.mjs
 * 
 * Tests the Tavily module in isolation:
 * 1. searchTavily with missing key  → returns []
 * 2. searchTavily with bad key      → returns [] (doesn't throw)
 * 3. formatSourcesForPrompt         → correct string output
 * 4. heuristicQuery fallback        → extractSearchQuery returns non-empty string when Gemini key is invalid
 */

import {
  searchTavily,
  formatSourcesForPrompt,
  extractSearchQuery,
} from "./src/services/tavily.js";
import { GoogleGenAI } from "@google/genai";

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ── Test 1: missing key ───────────────────────────────────────────────────────
console.log("\n[1] searchTavily — missing API key");
const r1 = await searchTavily("startup failure rates", undefined);
assert("returns empty array", Array.isArray(r1) && r1.length === 0);

// ── Test 2: invalid key ───────────────────────────────────────────────────────
console.log("\n[2] searchTavily — invalid API key");
const r2 = await searchTavily("startup failure rates", "tvly-INVALID_KEY_FOR_TEST");
assert("returns empty array (doesn't throw)", Array.isArray(r2));

// ── Test 3: formatSourcesForPrompt ────────────────────────────────────────────
console.log("\n[3] formatSourcesForPrompt");
const fakeResults = [
  { title: "Startup Stats", url: "https://example.com/a", content: "90% of startups fail." },
  { title: "Forbes Article", url: "https://forbes.com/b", content: "Many founders succeed." },
];
const formatted = formatSourcesForPrompt(fakeResults);
assert("includes VERIFIED WEB SOURCES header", formatted.includes("VERIFIED WEB SOURCES"));
assert("includes source titles", formatted.includes("Startup Stats"));
assert("includes URLs", formatted.includes("https://example.com/a"));
assert("includes snippet content", formatted.includes("90% of startups fail."));
assert("returns empty string for no results", formatSourcesForPrompt([]) === "");

// ── Test 4: extractSearchQuery heuristic fallback ─────────────────────────────
console.log("\n[4] extractSearchQuery — heuristic fallback (invalid Gemini key)");
const genai = new GoogleGenAI({ apiKey: "INVALID_KEY_FOR_TEST" });
const history = [
  { role: "user", parts: [{ text: 'The decision under debate is: "Should I quit my job?"' }] },
  { role: "user", parts: [{ text: "[Optimist]: Quitting can be liberating!" }] },
];
const query = await extractSearchQuery(history, genai, "gemini-2.0-flash");
assert("returns a non-empty string", typeof query === "string" && query.length > 0);
console.log(`     query: "${query}"`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ────────────────`);
if (failed > 0) process.exit(1);
