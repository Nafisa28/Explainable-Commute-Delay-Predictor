export default function PredictPage() {
  return (
    <div className="page-container">
      <h1 className="section-heading mb-2">Predict Commute Delay</h1>
      <p className="text-text-secondary mb-8">
        Select a route, choose a path variant, and pick your departure time to
        get an AI-powered delay prediction.
      </p>

      {/* Placeholder for route selector UI */}
      <div className="card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-route-dim text-3xl">
            🗺️
          </div>
          <h2 className="font-display text-xl font-semibold mb-2 text-ink">Route Selector</h2>
          <p className="text-sm text-text-secondary max-w-md">
            The route picker, time selector, and prediction trigger will be
            built here in the next phase. For now, this is a placeholder.
          </p>
        </div>
      </div>
    </div>
  );
}
