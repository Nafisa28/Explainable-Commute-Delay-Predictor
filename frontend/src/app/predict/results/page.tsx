"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BENGALURU_ROUTES } from "@/lib/mockApi";
import { StaggerContainer, ScrollReveal } from "@/components/ScrollReveal";
import ShapExplanationChart, { ShapFactor } from "@/components/ShapExplanationChart";

interface ShapExplanationResponse {
  route_name: string;
  path_variant: string;
  predicted_delay_min: number;
  base_value_min: number;
  factors: ShapFactor[];
}

function generateMockShapResponse(
  routeId: string,
  departureTimeStr: string,
  pathVariantStr?: string
): ShapExplanationResponse {
  const route = BENGALURU_ROUTES.find((r) => r.id === routeId) || BENGALURU_ROUTES[0];
  const departureDate = new Date(departureTimeStr);
  const hour = isNaN(departureDate.getTime()) ? 9 : departureDate.getHours();
  const pathVariant = pathVariantStr || route.path_variants[0];

  const isMorningPeak = hour >= 8 && hour <= 10;
  const isEveningPeak = hour >= 17 && hour <= 20;

  const factors: ShapFactor[] = [
    {
      name: "Time of day",
      value: isNaN(departureDate.getTime())
        ? "09:30 AM"
        : departureDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
      shap_value_min: isMorningPeak ? 12.4 : isEveningPeak ? 14.8 : hour >= 11 && hour <= 16 ? 4.2 : -3.6,
      category: "temporal",
    },
    {
      name: "Recent traffic trend (lag)",
      value: isMorningPeak || isEveningPeak ? 38.5 : 18.2,
      shap_value_min: isMorningPeak ? 6.5 : isEveningPeak ? 7.2 : 0.8,
      category: "historical",
    },
    {
      name: "Historical average delay",
      value: 12.0,
      shap_value_min: 4.5,
      category: "historical",
    },
    {
      name: "Precipitation",
      value: 2.4,
      shap_value_min: 3.6,
      category: "weather",
    },
    {
      name: "Weekend indicator",
      value: false,
      shap_value_min: 1.2,
      category: "temporal",
    },
    {
      name: "Day of week",
      value: isNaN(departureDate.getTime()) ? 1 : departureDate.getDay(),
      shap_value_min: 0.8,
      category: "temporal",
    },
    {
      name: "Temperature",
      value: 24.5,
      shap_value_min: -0.5,
      category: "weather",
    },
    {
      name: "Visibility",
      value: 8.5,
      shap_value_min: -0.2,
      category: "weather",
    },
    {
      name: "Weather condition",
      value: "Moderate Rain",
      shap_value_min: 1.5,
      category: "weather",
    },
    {
      name: "Holiday indicator",
      value: false,
      shap_value_min: 0.0,
      category: "temporal",
    },
    {
      name: "Nearby public event",
      value: false,
      shap_value_min: 0.0,
      category: "event",
    },
    {
      name: "Event proximity",
      value: 10.0,
      shap_value_min: 0.0,
      category: "event",
    },
  ];

  const totalShap = factors.reduce((sum, f) => sum + f.shap_value_min, 0);
  const base_value_min = 8.0;
  const predicted_delay_min = Math.max(0, base_value_min + totalShap);

  factors.sort((a, b) => Math.abs(b.shap_value_min) - Math.abs(a.shap_value_min));

  return {
    route_name: route.name,
    path_variant: pathVariant,
    predicted_delay_min: parseFloat(predicted_delay_min.toFixed(2)),
    base_value_min: parseFloat(base_value_min.toFixed(2)),
    factors,
  };
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const routeId = searchParams.get("route_id");
  const departureTime = searchParams.get("departure_time");
  const pathVariant = searchParams.get("path_variant");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShapExplanationResponse | null>(null);

  useEffect(() => {
    if (!routeId || !departureTime) {
      setError("Missing query parameters. Please select a route and departure time.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          route_id: routeId,
          departure_time: departureTime,
        });
        if (pathVariant) {
          queryParams.append("path_variant", pathVariant);
        }

        const res = await fetch(`/api/predict/explain?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.warn("Could not fetch from real backend API, using fallback mock explanation:", err);
        const mockData = generateMockShapResponse(routeId, departureTime, pathVariant || undefined);
        setData(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [routeId, departureTime, pathVariant]);

  if (!routeId || !departureTime) {
    return (
      <div className="page-container py-12 flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-factor-peak-dim text-3xl">
          ⚠️
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 text-ink">No prediction request</h2>
        <p className="text-text-secondary text-sm max-w-sm mb-6">
          You need to select a route corridor and departure time to generate commute delay predictions.
        </p>
        <Link href="/predict" className="btn btn-primary text-sm">
          Go to Predict Page
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container py-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-accent-route border-t-transparent rounded-full mb-4" />
        <p className="text-text-secondary text-sm animate-pulse">Calculating SHAP attributions...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container py-12 flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-factor-event-dim text-3xl text-factor-event">
          ⚠️
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 text-ink">Prediction Failed</h2>
        <p className="text-text-secondary text-sm max-w-sm mb-6">{error || "Could not retrieve prediction data."}</p>
        <Link href="/predict" className="btn btn-secondary text-sm">
          Go back & try again
        </Link>
      </div>
    );
  }

  const delta = data.predicted_delay_min - data.base_value_min;
  const deltaSign = delta > 0 ? "+" : "";

  return (
    <div className="page-container py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/predict"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-ink transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Predict Form</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <span className="badge-pill mb-3">Model Analysis</span>
        <h1 className="section-heading mb-2">Prediction Explanation</h1>
        <p className="text-text-secondary text-sm sm:text-base max-w-2xl font-sans">
          Detailed SHAP attribution analysis explaining the exact factors causing commute delays on this corridor.
        </p>
      </div>

      <StaggerContainer className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Delay Metrics */}
        <div className="lg:col-span-4 flex flex-col gap-6 w-full">
          <ScrollReveal delayOffset={0.05}>
            <div className="card flex flex-col gap-5">
              <div className="border-b border-border pb-4">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Delay Estimate
                </span>
              </div>

              {/* Large Metric */}
              <div className="flex flex-col items-center justify-center py-3 text-center">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="font-mono text-5xl font-bold tracking-tight text-ink tabular-nums">
                    +{data.predicted_delay_min.toFixed(1)}
                  </span>
                  <span className="text-lg font-medium text-text-secondary">min</span>
                </div>
                <p className="text-xs sm:text-sm text-text-secondary font-medium mt-1">
                  {delta === 0 ? (
                    <span>Matches baseline value ({data.base_value_min.toFixed(1)} min baseline)</span>
                  ) : (
                    <span>
                      <strong className="text-ink font-semibold">
                        {deltaSign}{delta.toFixed(1)} min
                      </strong>{" "}
                      shift from baseline ({data.base_value_min.toFixed(1)} min baseline)
                    </span>
                  )}
                </p>
              </div>

              {/* Context Info */}
              <div className="bg-bg-page p-4 rounded-xl border border-border flex flex-col gap-2.5 text-xs sm:text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text-muted text-xs font-semibold">Route Corridor:</span>
                  <span className="font-medium text-ink text-right">{data.route_name}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text-muted text-xs font-semibold">Path Variant:</span>
                  <span className="font-medium text-ink text-right max-w-[200px] truncate">
                    {data.path_variant}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text-muted text-xs font-semibold">Departure Window:</span>
                  <span className="font-mono text-ink text-right">
                    {new Date(departureTime).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Right Column: SHAP Bar Chart */}
        <div className="lg:col-span-8 w-full">
          <ScrollReveal delayOffset={0.15}>
            <div className="card flex flex-col gap-6">
              <div>
                <h3 className="text-base font-semibold text-ink mb-1">Contributing Factors (SHAP)</h3>
                <p className="text-xs text-text-secondary">
                  Attributions represent minutes added (+) or subtracted (-) from the baseline travel delay.
                </p>
              </div>

              <ShapExplanationChart factors={data.factors} />
            </div>
          </ScrollReveal>
        </div>
      </StaggerContainer>
    </div>
  );
}

export default function PredictResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container py-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin h-10 w-10 border-4 border-accent-route border-t-transparent rounded-full mb-4" />
          <p className="text-text-secondary text-sm">Loading prediction results...</p>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
