/**
 * ChatBubble.jsx
 *
 * Renders a single agent message bubble.
 *
 * Props:
 *   agentId     : string
 *   text        : string   — accumulated response text
 *   isStreaming : boolean  — true while chunks are still arriving
 *   sources     : Array<{ title: string, url: string }> | undefined
 *                 If present (Fact-Checker only), rendered as a small
 *                 linked source list below the bubble.
 */

import { AGENT_CONFIG, DEFAULT_CONFIG } from "../agentConfig";

export default function ChatBubble({ agentId, text, isStreaming, sources }) {
  const cfg = AGENT_CONFIG[agentId] ?? DEFAULT_CONFIG;

  // Show sources panel if the sources array exists (even if empty, to signal
  // the search happened) — but only for fact-checker.
  const hasSources = Array.isArray(sources);
  const hasLinks = hasSources && sources.length > 0;

  return (
    <div className="flex flex-col gap-1.5 animate-slide-up-fade">
      {/* Agent label */}
      <span className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${cfg.label}`}>
        <span className="text-base">{cfg.emoji}</span> {cfg.name}
      </span>

      {/* Main response bubble */}
      <div
        className={`rounded-2xl px-5 py-4 text-sm leading-relaxed text-gray-900 max-w-prose shadow-sm border ${cfg.bubble}`}
      >
        {!text && isStreaming ? (
          <div className="flex items-center gap-2 h-5">
            <span className="text-gray-500 italic text-sm">{cfg.name} is thinking</span>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.label} typing-dot opacity-60`} />
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.label} typing-dot opacity-60`} />
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.label} typing-dot opacity-60`} />
            </div>
          </div>
        ) : (
          <>
            {text}
            {isStreaming && (
              <span className="ml-1 inline-block w-1.5 h-4 bg-gray-400 animate-pulse align-middle rounded-sm" />
            )}
          </>
        )}
      </div>

      {/* Sources panel — only rendered for the Fact-Checker */}
      {hasSources && (
        <div className="ml-1 mt-0.5">
          {hasLinks ? (
            <details open className="group">
              <summary className="cursor-pointer text-xs text-sky-600 hover:text-sky-400 transition-colors select-none list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                Sources ({sources.length})
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1 pl-3">
                {sources.map((src, i) => (
                  <li key={src.url || i} className="flex items-start gap-1.5 text-xs">
                    <span className="text-sky-500 font-mono shrink-0">[{i + 1}]</span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-200 underline underline-offset-2 line-clamp-1 transition-colors"
                      title={src.url}
                    >
                      {src.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            /* Search ran but returned no results */
            <p className="text-xs text-gray-500 italic">
              🔍 No web sources found — responding from training knowledge.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
