/**
 * DecisionInput.jsx
 *
 * Form: textarea for the user's decision + rounds selector + "Start Debate" button.
 * Calls onSubmit(decision, rounds) when submitted.
 */

import { useState } from "react";

export default function DecisionInput({ onSubmit, isLoading }) {
  const [rounds, setRounds] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = e.target.elements.decision.value.trim();
    if (value) onSubmit(value, rounds);
  };

  const label = rounds === 1 ? "Quick" : rounds === 2 ? "Balanced" : rounds === 3 ? "In-depth" : rounds === 4 ? "Thorough" : "Exhaustive";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <textarea
        name="decision"
        rows={3}
        disabled={isLoading}
        placeholder="e.g. Should I quit my job to start a startup?"
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm
                   text-gray-800 placeholder-gray-400 shadow-sm resize-none
                   focus:outline-none focus:ring-2 focus:ring-violet-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* ── Rounds selector ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">
          Rounds
        </span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={isLoading}
              onClick={() => setRounds(n)}
              className={`w-8 h-8 rounded-full text-sm font-bold transition-all border
                ${rounds === n
                  ? "bg-violet-600 text-white border-violet-600 shadow-md scale-110"
                  : "bg-white text-gray-500 border-gray-300 hover:border-violet-400 hover:text-violet-600"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-xs text-violet-500 font-medium">{label}</span>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="self-end rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold
                   text-white shadow hover:bg-violet-700 active:scale-95
                   transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Debating…" : "⚔️ Start Debate"}
      </button>
    </form>
  );
}
