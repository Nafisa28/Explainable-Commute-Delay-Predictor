export default function PredictResultsPage() {
  return (
    <div className="page-container">
      <h1 className="section-heading mb-2">Prediction Results</h1>
      <p className="text-text-secondary mb-8">
        Your predicted delay and the SHAP explanation breakdown will appear here
        after running a prediction.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-factor-peak-dim text-3xl">
              ⏱️
            </div>
            <h2 className="font-display text-xl font-semibold mb-2 text-ink">Delay Estimate</h2>
            <p className="text-sm text-text-secondary max-w-sm">
              The predicted delay in minutes will be displayed prominently here,
              along with the route and time details.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-factor-rain-dim text-3xl">
              📊
            </div>
            <h2 className="font-display text-xl font-semibold mb-2 text-ink">SHAP Explanation</h2>
            <p className="text-sm text-text-secondary max-w-sm">
              A waterfall chart showing which features (traffic, weather, time
              of day) contributed most to the predicted delay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
