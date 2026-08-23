import { ScrollReveal } from "@/components/ScrollReveal";
import TiltContainer from "@/components/TiltContainer";

export default function HistoryPage() {
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-route-dim text-accent-route text-lg animate-float-icon">
          ⏱️
        </div>
        <h1 className="section-heading mb-0">Prediction History</h1>
      </div>
      <p className="text-text-secondary mb-8">
        Review your past delay predictions, actual outcomes, and SHAP
        explanations. Log in to access your history.
      </p>

      <ScrollReveal>
        <TiltContainer>
          <div className="card overflow-x-auto placeholder-card">
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
      </TiltContainer>
      </ScrollReveal>

      <p className="mt-4 text-center text-xs text-text-muted">
        Placeholder data — real predictions will appear once you start using the
        app.
      </p>
    </div>
  );
}
