import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="page-container flex items-center justify-center py-20">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-route text-white font-bold text-lg">
            CD
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Welcome back</h1>
          <p className="text-sm text-text-secondary mt-1">
            Log in to access your saved routes and prediction history.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-text-secondary">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              disabled
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-text-secondary">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              disabled
              className="input-field"
            />
          </div>
          <button disabled className="btn btn-primary w-full opacity-50 cursor-not-allowed">
            Log in
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent-route font-medium hover:underline">
            Sign up
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-text-muted">
          Auth integration coming soon — this is a placeholder.
        </p>
      </div>
    </div>
  );
}
