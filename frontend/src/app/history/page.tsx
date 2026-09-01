"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { ScrollReveal } from "@/components/ScrollReveal";
import TiltContainer from "@/components/TiltContainer";
import MagneticButton from "@/components/MagneticButton";
import ScanSweep from "@/components/ScanSweep";

interface ShapFactorItem {
  name: string;
  value: number | string;
  shap_value_min: number;
  category?: string;
}

interface PredictionRecord {
  id: string;
  user_id: string;
  requested_time: string;
  predicted_delay: number;
  route_name: string;
  origin_name?: string;
  origin_lat?: number;
  origin_lng?: number;
  dest_name?: string;
  dest_lat?: number;
  dest_lng?: number;
  distance_km?: number;
  live_travel_time_min?: number;
  free_flow_travel_time_min?: number;
  factors?: ShapFactorItem[];
  shap_breakdown?: {
    factors?: ShapFactorItem[];
    base_value_min?: number;
    live_travel_time_min?: number;
    free_flow_travel_time_min?: number;
    distance_km?: number;
  };
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function HistoryPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PredictionRecord | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/prediction-history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setHistory(data.prediction_history || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load prediction history.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) {
      if (user && token) {
        fetchHistory();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, user, token, fetchHistory]);

  const handleDelete = async (id: string, routeName: string) => {
    if (!token) return;

    const confirmed = window.confirm(`Remove prediction for "${routeName}" from history?`);
    if (!confirmed) return;

    setDeletingId(id);
    setActionFeedback(null);

    try {
      const res = await fetch(`${API_BASE_URL}/prediction-history/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }

      setHistory((prev) => prev.filter((r) => r.id !== id));
      setActionFeedback("Prediction record removed.");
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete prediction record.";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // 1. Unauthenticated Guest State
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
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h1 className="font-display text-2xl font-bold text-ink mb-2">
                  Log in to view your prediction history
                </h1>
                <p className="text-text-secondary text-sm mb-6 max-w-sm">
                  Sign in to review your past commute predictions, monitor accuracy against real outcomes, and inspect SHAP factor explanations.
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

  // 2. Authenticated User View
  return (
    <div className="page-container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="badge-pill mb-3">Prediction Log</span>
          <div className="flex items-center gap-3">
            <h1 className="section-heading mb-0">Prediction History</h1>
            {history.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent-route-dim text-accent-route font-mono">
                {history.length} {history.length === 1 ? "run" : "runs"}
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mt-1">
            Review past commute delay predictions, live factors, and SHAP explainability breakdowns.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Refresh history"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={loading ? "animate-spin" : ""}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Refresh</span>
          </button>
          <MagneticButton href="/predict" className="btn btn-primary text-sm">
            + New Prediction
          </MagneticButton>
        </div>
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
            <p className="text-text-secondary text-sm">Loading your prediction history...</p>
          </div>
        </div>
      ) : error ? (
        /* Error state */
        <div className="card text-center py-10 max-w-md mx-auto">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <MagneticButton type="button" onClick={fetchHistory} className="btn btn-secondary text-xs">
            Try Again
          </MagneticButton>
        </div>
      ) : history.length === 0 ? (
        /* Empty state */
        <ScrollReveal>
          <TiltContainer>
          <div className="card text-center py-12 max-w-lg mx-auto">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-surface text-accent-route text-2xl animate-float-icon">
              ⏱️
            </div>
            <h2 className="font-display text-lg font-bold text-ink mb-1">
              No predictions recorded yet
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm max-w-sm mx-auto mb-6">
              When you predict travel delays on Bengaluru routes while logged in, your predictions and SHAP factor breakdowns are automatically saved here.
            </p>
            <MagneticButton href="/predict" className="btn btn-primary text-sm inline-flex">
              Run your first prediction →
            </MagneticButton>
          </div>
          </TiltContainer>
        </ScrollReveal>
      ) : (
        /* Real Predictions Table */
        <div className="card p-0 overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-page/60 text-xs font-medium text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4 text-right">Predicted Delay</th>
                  <th className="py-3 px-4">Key SHAP Drivers</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((row) => {
                  const reqDate = new Date(row.requested_time);
                  const formattedDate = !isNaN(reqDate.getTime())
                    ? reqDate.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Recent";
                  const formattedTime = !isNaN(reqDate.getTime())
                    ? reqDate.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  const topFactors = (row.factors || row.shap_breakdown?.factors || [])
                    .filter((f) => f.shap_value_min !== 0)
                    .slice(0, 2);

                  // Re-run URL parameters
                  const rerunParams = new URLSearchParams();
                  if (row.origin_lat && row.origin_lng && row.dest_lat && row.dest_lng) {
                    rerunParams.append("origin_lat", String(row.origin_lat));
                    rerunParams.append("origin_lng", String(row.origin_lng));
                    rerunParams.append("dest_lat", String(row.dest_lat));
                    rerunParams.append("dest_lng", String(row.dest_lng));
                    if (row.origin_name) rerunParams.append("origin_name", row.origin_name);
                    if (row.dest_name) rerunParams.append("dest_name", row.dest_name);
                    rerunParams.append("departure_time", new Date().toISOString());
                  }

                  const rerunUrl = `/predict/results?${rerunParams.toString()}`;
                  const hasCoordinates = Boolean(row.origin_lat && row.dest_lat);

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-bg-page/40 transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-ink">{formattedDate}</div>
                        <div className="text-xs text-text-muted">{formattedTime}</div>
                      </td>

                      {/* Route Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink flex items-center gap-1.5">
                          <span>{row.route_name}</span>
                        </div>
                        {row.distance_km && (
                          <div className="text-xs text-text-secondary mt-0.5">
                            {row.distance_km.toFixed(1)} km
                            {row.live_travel_time_min && (
                              <span> · Est. {Math.round(row.live_travel_time_min)}m travel</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Predicted Delay */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md font-bold text-xs ${
                            row.predicted_delay > 15
                              ? "bg-factor-event-dim text-factor-event"
                              : row.predicted_delay > 5
                              ? "bg-factor-peak-dim text-factor-peak"
                              : "bg-accent-route-dim text-accent-route"
                          }`}
                        >
                          +{row.predicted_delay > 0 ? row.predicted_delay.toFixed(1) : "0.0"} min
                        </span>
                      </td>

                      {/* Top SHAP Drivers */}
                      <td className="py-3.5 px-4">
                        {topFactors.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {topFactors.map((f, fIdx) => {
                              const isPositive = f.shap_value_min > 0;
                              return (
                                <span
                                  key={fIdx}
                                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                    isPositive
                                      ? "bg-factor-peak/10 text-factor-peak border border-factor-peak/20"
                                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  }`}
                                  title={`${f.name}: ${isPositive ? "+" : ""}${f.shap_value_min.toFixed(1)} min`}
                                >
                                  {f.name} {isPositive ? "+" : ""}{f.shap_value_min.toFixed(1)}m
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">Standard commute conditions</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Re-run button */}
                          {hasCoordinates && (
                            <MagneticButton
                              href={rerunUrl}
                              className="btn btn-secondary text-xs py-1 px-2.5 h-7"
                            >
                              Re-predict
                            </MagneticButton>
                          )}

                          {/* Factor Details Modal trigger */}
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(row)}
                          className="touch-target p-1.5 text-text-secondary hover:text-accent-route hover:bg-accent-route-dim rounded-lg transition-colors"
                            title="View SHAP breakdown"
                          >
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
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id, row.route_name)}
                            disabled={deletingId === row.id}
                            className="touch-target p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete record"
                          >
                            {deletingId === row.id ? (
                              <span className="h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin block" />
                            ) : (
                              <svg
                                width="14"
                                height="14"
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SHAP Breakdown Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-bg-surface border border-border rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto"
            data-lenis-prevent
          >
            <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-border">
              <div>
                <span className="text-xs text-text-muted font-mono">
                  {new Date(selectedRecord.requested_time).toLocaleString()}
                </span>
                <h3 className="text-base font-bold text-ink mt-0.5">
                  {selectedRecord.route_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-text-muted hover:text-ink p-1 rounded-lg hover:bg-bg-page transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Delay summary */}
            <div className="grid grid-cols-2 gap-3 mb-5 text-center">
              <div className="p-3 rounded-xl bg-bg-page border border-border">
                <div className="text-xs text-text-secondary mb-0.5">Predicted Delay</div>
                <div className="text-xl font-mono font-bold text-accent-route">
                  +{selectedRecord.predicted_delay.toFixed(1)} min
                </div>
              </div>
              <div className="p-3 rounded-xl bg-bg-page border border-border">
                <div className="text-xs text-text-secondary mb-0.5">Est. Travel Time</div>
                <div className="text-xl font-mono font-bold text-ink">
                  {selectedRecord.live_travel_time_min
                    ? `${Math.round(selectedRecord.live_travel_time_min)} min`
                    : "—"}
                </div>
              </div>
            </div>

            {/* Factor list */}
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2.5">
                Explainable Factor Contributions (SHAP)
              </h4>
              <div className="space-y-2">
                {(selectedRecord.factors || selectedRecord.shap_breakdown?.factors || []).map(
                  (f, idx) => {
                    const isPos = f.shap_value_min > 0;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-bg-page/70 border border-border text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-ink">{f.name}</span>
                          <span className="text-[11px] text-text-secondary">
                            Observed: {String(f.value)}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            isPos
                              ? "bg-factor-peak/10 text-factor-peak"
                              : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {isPos ? "+" : ""}
                          {f.shap_value_min.toFixed(1)} min
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="btn btn-secondary text-xs py-2 px-4"
              >
                Close
              </button>
              {selectedRecord.origin_lat && selectedRecord.dest_lat && (
                <MagneticButton
                  href={`/predict/results?${new URLSearchParams({
                    origin_lat: String(selectedRecord.origin_lat),
                    origin_lng: String(selectedRecord.origin_lng),
                    dest_lat: String(selectedRecord.dest_lat),
                    dest_lng: String(selectedRecord.dest_lng),
                    origin_name: selectedRecord.origin_name || "Origin",
                    dest_name: selectedRecord.dest_name || "Destination",
                    departure_time: new Date().toISOString(),
                  }).toString()}`}
                  className="btn btn-primary text-xs py-2 px-4"
                >
                  Re-predict this route →
                </MagneticButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
