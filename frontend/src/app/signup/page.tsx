import Link from "next/link";
import { ScrollReveal } from "@/components/ScrollReveal";
import MagneticButton from "@/components/MagneticButton";
import TiltContainer from "@/components/TiltContainer";

export default function SignupPage() {
  return (
    <div className="page-container flex items-center justify-center py-20">
      <ScrollReveal className="w-full max-w-md">
        <TiltContainer>
          <div className="card placeholder-card">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-route text-white font-bold text-lg animate-float-icon">
                CD
              </div>
              <h1 className="font-display text-2xl font-bold text-ink">Create an account</h1>
              <p className="text-sm text-text-secondary mt-1">
                Sign up to save routes and track your prediction history.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-text-secondary">Full name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  disabled
                  className="input-field"
                />
              </div>
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
              <MagneticButton disabled className="btn btn-primary w-full opacity-50 cursor-not-allowed">
                Create account
              </MagneticButton>
            </div>

            <p className="mt-6 text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <Link href="/login" className="text-accent-route font-medium hover:underline">
                Log in
              </Link>
            </p>

            <p className="mt-3 text-center text-xs text-text-muted">
              Auth integration coming soon — this is a placeholder.
            </p>
          </div>
        </TiltContainer>
      </ScrollReveal>
    </div>
  );
}
