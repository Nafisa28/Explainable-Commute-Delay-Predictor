"use client";

import { useState, useRef } from "react";
import { Route, PredictionResponse } from "@/types/prediction";
import { getPrediction } from "@/lib/mockApi";
import RoutePicker from "@/components/RoutePicker";
import DepartureTimePicker from "@/components/DepartureTimePicker";
import DelayPrediction from "@/components/DelayPrediction";
import { ScrollReveal } from "@/components/ScrollReveal";

export default function PredictPage() {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [departureTime, setDepartureTime] = useState<string>(() =>
    new Date().toISOString()
  );

  // Prediction State
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request ID ref to prevent race conditions & stale responses
  const activeRequestIdRef = useRef(0);

  const fetchPrediction = async (routeId: string, timeIso: string) => {
    const currentId = ++activeRequestIdRef.current;

    try {
      setLoading(true);
      setError(null);
      const res = await getPrediction(routeId, timeIso);

      // Discard response if a newer selection/request superseded this one
      if (currentId !== activeRequestIdRef.current) return;

      setPrediction(res);
    } catch (err: unknown) {
      // Discard error if superseded
      if (currentId !== activeRequestIdRef.current) return;

      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching the delay prediction.";
      setError(message);
      setPrediction(null);
    } finally {
      if (currentId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;
    fetchPrediction(selectedRoute.id, departureTime);
  };

  const handleRetry = () => {
    if (!selectedRoute) return;
    // Retries with the currently selected route and departure time
    fetchPrediction(selectedRoute.id, departureTime);
  };

  return (
    <div className="page-container py-8">
      {/* Header */}
      <div className="mb-8">
        <span className="badge-pill mb-3">Workspace</span>
        <h1 className="section-heading mb-2">Predict Commute Delay</h1>
        <p className="text-text-secondary text-sm sm:text-base max-w-2xl">
          Select a monitored Bengaluru corridor and specify your departure time
          to estimate peak delay and understand contributing factors.
        </p>
      </div>

      <ScrollReveal>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Route Picker (7 cols on lg) */}
          <div className="lg:col-span-7">
            <div className="card">
              <RoutePicker
                selectedRoute={selectedRoute}
                onSelectRoute={(route) => {
                  setSelectedRoute(route);
                  // Invalidate any in-flight request and clear old prediction
                  activeRequestIdRef.current++;
                  setLoading(false);
                  setPrediction(null);
                  setError(null);
                }}
              />
            </div>
          </div>

          {/* Right Column: Departure Time & Prediction Result (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Input & Action Card */}
            <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
              <DepartureTimePicker
                value={departureTime}
                onChange={(iso) => {
                  setDepartureTime(iso);
                  // Invalidate in-flight request if user actively tweaks time
                  activeRequestIdRef.current++;
                  setLoading(false);
                  setError(null);
                }}
              />

              <div className="divider my-0" />

              {/* Selected Route Summary Review */}
              <div className="flex flex-col gap-2 bg-bg-page p-3.5 rounded-xl border border-border">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Selection Summary
                </span>
                {selectedRoute ? (
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold text-ink">
                      {selectedRoute.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {selectedRoute.origin} ➔ {selectedRoute.destination}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-text-muted italic">
                    No route selected yet. Pick a corridor on the left.
                  </span>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={!selectedRoute || loading}
                className="btn btn-primary w-full py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Calculating Prediction...</span>
                  </>
                ) : (
                  <>
                    <span>Get Prediction</span>
                    <svg
                      width="16"
                      height="16"
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
                  </>
                )}
              </button>
            </form>

            {/* Delay Prediction Display (Loading / Error / Result) */}
            {(loading || error || prediction) && (
              <DelayPrediction
                prediction={prediction}
                loading={loading}
                error={error}
                onRetry={handleRetry}
              />
            )}
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
