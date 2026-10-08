/**
 * VerdictCard.jsx
 *
 * Renders the final synthesized verdict and confidence score.
 */

export default function VerdictCard({ verdict, reasoning, confidenceScore }) {
  // Determine color based on confidence score
  let scoreColor = "bg-gray-400";
  let textColor = "text-gray-700";
  
  if (confidenceScore !== null) {
    if (confidenceScore >= 80) {
      scoreColor = "bg-emerald-500";
      textColor = "text-emerald-700";
    } else if (confidenceScore >= 50) {
      scoreColor = "bg-amber-500";
      textColor = "text-amber-700";
    } else {
      scoreColor = "bg-rose-500";
      textColor = "text-rose-700";
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-6 animate-reveal-card rounded-3xl border-2 border-gray-100 bg-white p-8 shadow-xl relative overflow-hidden">
      {/* Decorative top border based on score */}
      <div className={`absolute top-0 left-0 w-full h-1.5 ${scoreColor}`} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-5 gap-4">
        <h2 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
          <span>⚖️</span> Final Verdict
        </h2>
        {confidenceScore !== null && (
          <div className={`flex flex-col items-end`}>
            <span className={`text-sm font-bold uppercase tracking-wider ${textColor}`}>
              {confidenceScore}% Confidence
            </span>
            <div className="mt-1.5 h-2.5 w-32 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full ${scoreColor} transition-all duration-1500 ease-out`}
                style={{ width: `${confidenceScore}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div className="text-lg font-medium leading-relaxed text-gray-900">
          {verdict}
        </div>
        <div className="rounded-xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-700 border border-gray-100">
          <strong className="block text-gray-900 font-bold mb-2 uppercase tracking-wide text-xs">Reasoning</strong>
          {reasoning}
        </div>
      </div>
    </div>
  );
}
