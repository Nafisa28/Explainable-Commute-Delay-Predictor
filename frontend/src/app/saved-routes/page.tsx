"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { StaggerContainer, ScrollReveal } from "@/components/ScrollReveal";
import TiltContainer from "@/components/TiltContainer";
import MagneticButton from "@/components/MagneticButton";
import ScanSweep from "@/components/ScanSweep";

interface SavedRoute {
  id: string;
  user_id: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_name: string;
  dest_lat: number;
  dest_lng: number;
  nickname: string | null;
  created_at: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function SavedRoutesPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/saved-routes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setRoutes(data.saved_routes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load saved routes.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) {
      if (user && token) {
        fetchRoutes();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, user, token, fetchRoutes]);

  const handleDelete = async (id: string, routeName: string) => {
    if (!token) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${routeName}"?`);
    if (!confirmed) return;

    setDeletingId(id);
    setActionFeedback(null);

    try {
      const res = await fetch(`${API_BASE_URL}/saved-routes/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }

      // Optimistically remove from list
      setRoutes((prev) => prev.filter((r) => r.id !== id));
      setActionFeedback("Route deleted successfully.");
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete route.";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // 1. Unauthenticated State
  if (!authLoading && !user) {
    return (
      <div className="page-container py-12">
        <ScrollReveal>
          <div className="max-w-lg mx-auto text-center">
            <TiltContainer>
              <div className="card py-10 px-8 flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-route/10 text-accent-route text-2xl mb-5 animate-float-icon">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                  </svg>
                </div>
                <h1 className="font-display text-2xl font-bold text-ink mb-2">
                  Log in to save &amp; view routes
                </h1>
                <p className="text-text-secondary text-sm mb-6 max-w-sm">
                  Sign in to access your bookmarked Bengaluru commute routes, run instant delay predictions, and manage your daily commutes.
                </p>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <MagneticButton href="/login" className="btn btn-primary text-sm flex-1 sm:flex-initial">
                    Log in
                  </MagneticButton>
                  <MagneticButton href="/signup" className="btn btn-secondary text-sm flex-1 sm:flex-initial">
                    Create account
                  </MagneticButton>
                </div>
              </div>
            </TiltContainer>
          </div>
        </ScrollReveal>
      </div>
    );
  }

  // 2. Main Authenticated View
  return (
    <div className="page-container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="badge-pill mb-3">Saved Commutes</span>
          <h1 className="section-heading mb-2">Saved Routes</h1>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl">
            Quickly re-run delay predictions and monitor congestion along your frequent travel paths.
          </p>
        </div>
        <MagneticButton href="/predict" className="btn btn-primary text-sm shrink-0 self-start sm:self-auto">
          + Predict New Route
        </MagneticButton>
      </div>

      {actionFeedback && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-medium flex items-center gap-2">
          <span>✓</span>
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <div className="card glow-metric is-loading relative overflow-hidden w-full max-w-sm flex flex-col items-center py-10">
            <ScanSweep />
            <div className="animate-spin h-8 w-8 border-4 border-accent-route border-t-transparent rounded-full mb-3" />
            <p className="text-text-secondary text-sm">Loading your saved routes...</p>
          </div>
        </div>
      ) : error ? (
        /* Error state */
        <div className="card text-center py-10 max-w-md mx-auto">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <MagneticButton type="button" onClick={fetchRoutes} className="btn btn-secondary text-xs">
            Try Again
          </MagneticButton>
        </div>
      ) : routes.length === 0 ? (
        /* Empty state */
        <ScrollReveal>
          <TiltContainer>
          <div className="card text-center py-12 max-w-lg mx-auto">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-surface text-accent-route text-xl">
              🗺️
            </div>
            <h2 className="font-display text-lg font-bold text-ink mb-1">
              No saved routes yet
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm max-w-sm mx-auto mb-6">
              Predict any commute in Bengaluru and click &quot;Save this route&quot; on the results page to bookmark it here for instant one-click predictions.
            </p>
            <MagneticButton href="/predict" className="btn btn-primary text-sm inline-flex">
              Start predicting
            </MagneticButton>
          </div>
          </TiltContainer>
        </ScrollReveal>
      ) : (
        /* Real Routes Grid */
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {routes.map((route, idx) => {
            const displayTitle = route.nickname || `${route.origin_name} → ${route.dest_name}`;
            const isCustomName = Boolean(route.nickname);

            // Construct prediction URL for instant re-prediction
            const predictUrl = `/predict/results?${new URLSearchParams({
              origin_name: route.origin_name,
              origin_lat: String(route.origin_lat),
              origin_lng: String(route.origin_lng),
              dest_name: route.dest_name,
              dest_lat: String(route.dest_lat),
              dest_lng: String(route.dest_lng),
              departure_time: new Date().toISOString(),
            }).toString()}`;

            return (
              <ScrollReveal key={route.id}>
                <TiltContainer className="h-full">
                  <div className="card flex flex-col justify-between h-full group hover:border-accent-route/40 transition-colors">
                    <div>
                      {/* Card Top: Avatar & Nickname/Title */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-route/10 text-accent-route font-bold font-mono text-sm"
                            style={{ animationDelay: `${idx * 0.15}s` }}
                          >
                            R{idx + 1}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-ink leading-tight line-clamp-1">
                              {displayTitle}
                            </h3>
                            {isCustomName && (
                              <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                                {route.origin_name} → {route.dest_name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(route.id, displayTitle)}
                          disabled={deletingId === route.id}
                          title="Delete route"
                          className="touch-target text-text-muted hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          {deletingId === route.id ? (
                            <span className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Route Path Indicator */}
                      <div className="bg-bg-page/70 rounded-xl p-3 border border-border flex flex-col gap-2 mb-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-accent-route shrink-0" />
                          <span className="text-text-secondary truncate">
                            <strong className="text-ink font-medium">From:</strong> {route.origin_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-text-secondary truncate">
                            <strong className="text-ink font-medium">To:</strong> {route.dest_name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                      <span className="text-[11px] text-text-muted">
                        Saved {new Date(route.created_at).toLocaleDateString()}
                      </span>
                      <MagneticButton
                        href={predictUrl}
                        className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <span>Predict Live</span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </MagneticButton>
                    </div>
                  </div>
                </TiltContainer>
              </ScrollReveal>
            );
          })}
        </StaggerContainer>
      )}
    </div>
  );
}

