export default function HistoryPage() {
  return (
    <div className="page-container">
      <h1 className="section-heading mb-2">Prediction History</h1>
      <p className="text-text-secondary mb-8">
        Review your past delay predictions, actual outcomes, and SHAP
        explanations. Log in to access your history.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="pb-3 pr-4 font-medium">Date</th>
              <th className="pb-3 pr-4 font-medium">Route</th>
              <th className="pb-3 pr-4 font-medium">Predicted</th>
              <th className="pb-3 pr-4 font-medium">Actual</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            {[
              { date: "Aug 22, 2026", route: "Whitefield → MG Road", predicted: "+12 min", actual: "—", status: "Pending" },
              { date: "Aug 21, 2026", route: "Koramangala → Indiranagar", predicted: "+5 min", actual: "+6 min", status: "Accurate" },
              { date: "Aug 20, 2026", route: "HSR Layout → Marathahalli", predicted: "+18 min", actual: "+15 min", status: "Close" },
            ].map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 text-text-primary">{row.date}</td>
                <td className="py-3 pr-4">{row.route}</td>
                <td className="py-3 pr-4 font-mono font-semibold text-accent-route">{row.predicted}</td>
                <td className="py-3 pr-4 font-mono">{row.actual}</td>
                <td className="py-3">
                  <span className={`badge-status ${
                    row.status === "Accurate"
                      ? "bg-factor-rain-dim text-factor-rain"
                      : row.status === "Close"
                        ? "bg-factor-peak-dim text-factor-peak"
                        : "bg-bg-page text-text-muted"
                  }`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        Placeholder data — real predictions will appear once you start using the
        app.
      </p>
    </div>
  );
}
