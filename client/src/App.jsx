import { useRef, useEffect } from "react";
import DecisionInput from "./components/DecisionInput";
import DebateArena from "./components/DebateArena";
import VerdictCard from "./components/VerdictCard";
import { useDebateStream } from "./hooks/useDebateStream";

export default function App() {
  const { messages, verdict, roundInfo, isLoading, error, startDebate, resetDebate } = useDebateStream();
  const bottomRef = useRef(null);

  // Auto-scroll to bottom whenever messages update.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, verdict]);

  const hasStarted = messages.length > 0 || isLoading;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans selection:bg-violet-200">
      {/* ── Header ── */}
      {hasStarted && (
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm animate-slide-up-fade">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              ⚔️ <span className="text-violet-600">ClashAI</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Multi-agent AI decision debate
            </p>
          </div>
          {!isLoading && (
            <button
              onClick={resetDebate}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full"
            >
              ↩ New debate
            </button>
          )}
        </header>
      )}

      {/* ── Main ── */}
      <main className={`flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 ${hasStarted ? 'py-6 gap-6' : 'justify-center py-12'}`}>
        
        {!hasStarted && (
          <div className="text-center mb-10 animate-slide-up-fade">
            <h1 className="text-5xl font-black tracking-tight text-gray-900 mb-4">
              ⚔️ Clash<span className="text-violet-600">AI</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Drop in a decision you're wrestling with. Our AI agents will debate the pros, cons, and facts to help you find clarity.
            </p>
          </div>
        )}

        {/* Input */}
        <section className={hasStarted ? "animate-slide-up-fade" : "animate-slide-up-fade [animation-delay:200ms] opacity-0"}>
          <DecisionInput onSubmit={startDebate} isLoading={isLoading} />
        </section>

        {/* Error banner */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm animate-slide-up-fade">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Status pill & Round indicator */}
        {hasStarted && (
          <div className="flex items-center justify-between animate-slide-up-fade px-2">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                Debate in progress…
              </div>
            ) : <div />}
            
            {roundInfo && !verdict && (
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                Round {roundInfo.current} of {roundInfo.max}
              </div>
            )}
          </div>
        )}

        {/* Debate messages */}
        <DebateArena messages={messages} bottomRef={bottomRef} />

        {/* Final Verdict */}
        {verdict && (
          <VerdictCard
            verdict={verdict.verdict}
            reasoning={verdict.reasoning}
            confidenceScore={verdict.confidenceScore}
          />
        )}
      </main>
    </div>
  );
}
