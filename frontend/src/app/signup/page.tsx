"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ScrollReveal } from "@/components/ScrollReveal";
import MagneticButton from "@/components/MagneticButton";
import TiltContainer from "@/components/TiltContainer";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim() || undefined,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data?.session) {
        // Immediate session created (auto-confirm enabled)
        setSuccessMessage("Account created successfully! Redirecting...");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1200);
      } else if (data?.user) {
        // Email confirmation required
        setRequiresConfirmation(true);
        setSuccessMessage(
          "Confirmation email sent! Please check your inbox and verify your email to log in."
        );
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred during signup.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container flex items-center justify-center py-20">
      <ScrollReveal className="w-full max-w-md">
        <TiltContainer>
          <div className="card">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-route text-white font-bold text-lg animate-float-icon">
                CD
              </div>
              <h1 className="font-display text-2xl font-bold text-ink">Create an account</h1>
              <p className="text-sm text-text-secondary mt-1">
                Sign up to save routes and access your custom commute delays.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-600 flex items-start gap-2">
                <span className="shrink-0 font-bold">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 flex items-start gap-2">
                <span className="shrink-0 font-bold">✓</span>
                <span>{successMessage}</span>
              </div>
            )}

            {requiresConfirmation ? (
              <div className="text-center py-4 space-y-4">
                <p className="text-sm text-text-secondary">
                  We sent a confirmation link to <strong className="text-ink">{email}</strong>.
                  Once verified, you can sign in directly.
                </p>
                <Link href="/login" className="btn btn-primary inline-flex text-sm">
                  Go to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-text-secondary" htmlFor="signup-name">
                    Full name <span className="text-text-muted text-xs">(optional)</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-text-secondary" htmlFor="signup-email">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-text-secondary" htmlFor="signup-password">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="input-field"
                  />
                </div>

                <MagneticButton
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary w-full ${loading ? "opacity-75 cursor-wait" : ""}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    "Create account"
                  )}
                </MagneticButton>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <Link href="/login" className="text-accent-route font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </TiltContainer>
      </ScrollReveal>
    </div>
  );
}

