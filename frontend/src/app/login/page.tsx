"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ScrollReveal } from "@/components/ScrollReveal";
import MagneticButton from "@/components/MagneticButton";
import TiltContainer from "@/components/TiltContainer";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("invalid login credentials")) {
          setError("Invalid email or password. Please check your credentials and try again.");
        } else if (signInError.message.toLowerCase().includes("email not confirmed")) {
          setError("Please verify your email address before logging in.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (data?.session) {
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred during login.";
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
              <h1 className="font-display text-2xl font-bold text-ink">Welcome back</h1>
              <p className="text-sm text-text-secondary mt-1">
                Log in to access your saved routes and custom commute insights.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-600 flex items-start gap-2">
                <span className="shrink-0 font-bold">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-text-secondary" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
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
                <label className="block text-sm font-medium mb-1.5 text-text-secondary" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="••••••••"
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
                    Signing in...
                  </span>
                ) : (
                  "Log in"
                )}
              </MagneticButton>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-accent-route font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </TiltContainer>
      </ScrollReveal>
    </div>
  );
}

