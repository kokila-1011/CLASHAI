/**
 * DecisionInput.jsx
 *
 * Simple form: a textarea for the user's decision + a "Start Debate" button.
 * The parent controls `isLoading` to disable the form while the debate runs.
 */

export default function DecisionInput({ onSubmit, isLoading }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const value = e.target.elements.decision.value.trim();
    if (value) onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
