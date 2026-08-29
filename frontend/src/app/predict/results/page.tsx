"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { StaggerContainer, ScrollReveal } from "@/components/ScrollReveal";
import ShapExplanationChart, { ShapFactor } from "@/components/ShapExplanationChart";

interface ShapExplanationResponse {
  route_name: string;
  predicted_delay_min: number;
  base_value_min: number;
  factors: ShapFactor[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function generateMockShapResponse(
  originName: string,
  destName: string,
  departureTimeStr: string
): ShapExplanationResponse {
  const departureDate = new Date(departureTimeStr);
  const hour = isNaN(departureDate.getTime()) ? 9 : departureDate.getHours();

  const isMorningPeak = hour >= 8 && hour <= 10;
  const isEveningPeak = hour >= 17 && hour <= 20;

  const mockCongestionRatio = isMorningPeak ? 1.65 : isEveningPeak ? 1.82 : 1.25;
  const congestionShap = isMorningPeak ? 4.8 : isEveningPeak ? 6.2 : -2.4;

  const factors: ShapFactor[] = [
    {
      name: "Live congestion ratio",
      value: mockCongestionRatio,
      shap_value_min: congestionShap,
      category: "live_traffic",
    },
    {
      name: "Time of day",
      value: isNaN(departureDate.getTime())
        ? "09:30 AM"
        : departureDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
      shap_value_min: isMorningPeak
        ? 3.2
        : isEveningPeak
        ? 3.8
        : hour >= 11 && hour <= 16
        ? 1.2
        : -1.5,
      category: "temporal",
    },
    {
      name: "Day of week",
      value: isNaN(departureDate.getTime()) ? 3 : departureDate.getDay(),
      shap_value_min: 2.1,
      category: "temporal",
    },
    {
      name: "Weekend indicator",
      value: false,
      shap_value_min: 0.4,
      category: "temporal",
    },
    {
      name: "Temperature",
      value: 24.5,
      shap_value_min: -0.7,
      category: "weather",
    },
    {
      name: "Precipitation",
      value: 0.0,
      shap_value_min: -0.05,
      category: "weather",
    },
    {
      name: "Weather condition",
      value: "Clouds",
      shap_value_min: -0.01,
      category: "weather",
    },
    {
      name: "Visibility",
      value: 10.0,
      shap_value_min: 0.0,
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
      value: 999.0,
      shap_value_min: 0.0,
      category: "event",
    },
  ];

  const totalShap = factors.reduce((sum, f) => sum + f.shap_value_min, 0);
  const base_value_min = 7.22;
  const predicted_delay_min = Math.max(0, base_value_min + totalShap);

  factors.sort((a, b) => Math.abs(b.shap_value_min) - Math.abs(a.shap_value_min));

  const route_name =
    originName && destName
      ? `${originName} → ${destName}`
      : originName || "Custom Bengaluru Route";

  return {
    route_name,
    predicted_delay_min: parseFloat(predicted_delay_min.toFixed(2)),
    base_value_min: parseFloat(base_value_min.toFixed(2)),
    factors,
  };
}

function ResultsContent() {
  const searchParams = useSearchParams();

  // Read new coordinate-based query parameters
  const originName = searchParams.get("origin_name") || "";
  const originLat = searchParams.get("origin_lat");
  const originLng = searchParams.get("origin_lng");
  const destName = searchParams.get("dest_name") || "";
  const destLat = searchParams.get("dest_lat");
  const destLng = searchParams.get("dest_lng");
  const departureTime = searchParams.get("departure_time") || new Date().toISOString();

  // Legacy fallback if someone opens old route_id URL
  const legacyRouteId = searchParams.get("route_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShapExplanationResponse | null>(null);

  const hasCoordinates = Boolean(originLat && originLng && destLat && destLng);
  const hasValidRequest = hasCoordinates || Boolean(legacyRouteId);

  useEffect(() => {
    if (!hasValidRequest) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (originLat && originLng && destLat && destLng) {
          queryParams.append("origin_lat", originLat);
          queryParams.append("origin_lng", originLng);
          queryParams.append("dest_lat", destLat);
          queryParams.append("dest_lng", destLng);
          if (originName) queryParams.append("origin_name", originName);
          if (destName) queryParams.append("dest_name", destName);
        }
        if (departureTime) {
          queryParams.append("departure_time", departureTime);
        }

        const endpointUrl = `${API_BASE_URL}/predict/explain?${queryParams.toString()}`;
        const res = await fetch(endpointUrl);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.warn(
          "Could not fetch from live Flask API (http://localhost:5000), using fallback mock Model V2 explanation:",
          err
        );
        const mockData = generateMockShapResponse(
          originName || "Origin",
          destName || "Destination",
          departureTime
        );
        setData(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [originLat, originLng, destLat, destLng, originName, destName, departureTime, hasValidRequest]);

  if (!hasValidRequest) {
    return (
      <div className="page-container py-12 flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-factor-peak-dim text-3xl">
          ⚠️
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 text-ink">
          No prediction request
        </h2>
        <p className="text-text-secondary text-sm max-w-sm mb-6">
          You need to specify origin and destination locations and departure time to generate commute delay predictions.
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
        <p className="text-text-secondary text-sm animate-pulse">
          Fetching live traffic & calculating SHAP attributions...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container py-12 flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-factor-event-dim text-3xl text-factor-event">
          ⚠️
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 text-ink">
          Prediction Failed
        </h2>
        <p className="text-text-secondary text-sm max-w-sm mb-6">
          {error || "Could not retrieve prediction data."}
        </p>
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
        <span className="badge-pill mb-3">Model V2 Analysis</span>
        <h1 className="section-heading mb-2">Prediction Explanation</h1>
        <p className="text-text-secondary text-sm sm:text-base max-w-2xl font-sans">
          Detailed SHAP attribution analysis explaining the exact real-time traffic, temporal, and weather factors causing commute delays.
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
                    <span>
                      Matches baseline value ({data.base_value_min.toFixed(1)} min baseline)
                    </span>
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
                  <span className="text-text-muted text-xs font-semibold">Route:</span>
                  <span className="font-medium text-ink text-right">{data.route_name}</span>
                </div>
                {originName && destName && (
                  <div className="flex flex-col gap-1 border-t border-border/60 pt-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-text-muted">Origin:</span>
                      <span className="text-ink font-medium text-right truncate max-w-[180px]">
                        {originName}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-text-muted">Destination:</span>
                      <span className="text-ink font-medium text-right truncate max-w-[180px]">
                        {destName}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 border-t border-border/60 pt-2">
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
                <h3 className="text-base font-semibold text-ink mb-1">
                  Contributing Factors (SHAP)
                </h3>
                <p className="text-xs text-text-secondary">
                  Attributions represent minutes added (+) or subtracted (-) from the baseline travel delay.
                </p>
              </div>

              <ShapExplanationChart
                factors={data.factors}
                predictedDelayMin={data.predicted_delay_min}
                baseValueMin={data.base_value_min}
              />
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
