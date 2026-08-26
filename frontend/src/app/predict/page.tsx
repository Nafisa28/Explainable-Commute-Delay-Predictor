"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Route } from "@/types/prediction";
import RoutePicker from "@/components/RoutePicker";
import DepartureTimePicker from "@/components/DepartureTimePicker";
import { ScrollReveal } from "@/components/ScrollReveal";

export default function PredictPage() {
  const router = useRouter();
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [departureTime, setDepartureTime] = useState<string>(() =>
    new Date().toISOString()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;

    const queryParams = new URLSearchParams({
      route_id: selectedRoute.id,
      departure_time: departureTime,
    });
    
    if (selectedRoute.path_variants && selectedRoute.path_variants.length > 0) {
      queryParams.append("path_variant", selectedRoute.path_variants[0]);
    }

    router.push(`/predict/results?${queryParams.toString()}`);
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
                disabled={!selectedRoute}
                className="btn btn-primary w-full py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all flex items-center justify-center gap-2"
              >
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
              </button>
            </form>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
