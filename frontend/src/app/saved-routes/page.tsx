export default function SavedRoutesPage() {
  return (
    <div className="page-container">
      <h1 className="section-heading mb-2">Saved Routes</h1>
      <p className="text-text-secondary mb-8">
        Your bookmarked routes will appear here for quick access to predictions.
        Log in to save and manage routes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-route-dim text-accent-route font-bold font-mono text-sm">
                R{i}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Example Route {i}</h3>
                <p className="text-xs text-text-secondary">Origin → Destination</p>
              </div>
            </div>
            <div className="h-px bg-border mb-3" />
            <p className="text-xs text-text-muted">
              Placeholder — real saved routes will load from your account.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
