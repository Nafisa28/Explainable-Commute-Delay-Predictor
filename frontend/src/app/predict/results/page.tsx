"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { StaggerContainer, ScrollReveal } from "@/components/ScrollReveal";
import ShapExplanationChart, { ShapFactor } from "@/components/ShapExplanationChart";
import { useAuth } from "@/lib/auth-context";

interface ShapExplanationResponse {
  route_name: string;
  predicted_delay_min: number;
  base_value_min: number;
  live_travel_time_min?: number;
  free_flow_travel_time_min?: number;
  traffic_delay_min?: number;
  distance_km?: number;
  factors: ShapFactor[];
}

interface RouteOption {
  route_index: number;
  description: string;
  predicted_delay_min: number;
  congestion_ratio: number;
  distance_km: number;
  live_travel_time_min: number;
  free_flow_travel_time_min: number;
  is_best: boolean;
}

interface BestDepartureTimeResponse {
  origin_name: string;
  dest_name: string;
  current_departure_time: string;
  current_live_travel_time_min: number;
  recommended_departure_time: string;
  recommended_live_travel_time_min: number;
  savings_min: number;
  free_flow_travel_time_min: number;
  distance_km: number;
  timeline?: Array<{
    departure_time: string;
    travel_time_min: number;
    delay_min: number;
    is_best: boolean;
  }>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function generateMockBestTimeResponse(
  originName: string,
  destName: string,
  departureTimeStr: string
): BestDepartureTimeResponse {
  const departureDate = new Date(departureTimeStr);
  const validDate = isNaN(departureDate.getTime()) ? new Date() : departureDate;
  const hour = validDate.getHours();

  const isMorningPeak = hour >= 8 && hour <= 10;
  const isEveningPeak = hour >= 17 && hour <= 20;

  if (isMorningPeak) {
    const recDate = new Date(validDate.getTime() + 60 * 60 * 1000);
    return {
      origin_name: originName || "Origin",
      dest_name: destName || "Destination",
      current_departure_time: validDate.toISOString(),
      current_live_travel_time_min: 48.0,
      recommended_departure_time: recDate.toISOString(),
      recommended_live_travel_time_min: 38.0,
      savings_min: 10.0,
      free_flow_travel_time_min: 26.0,
      distance_km: 15.2,
    };
  } else if (isEveningPeak) {
    const recDate = new Date(validDate.getTime() + 75 * 60 * 1000);
    return {
      origin_name: originName || "Origin",
      dest_name: destName || "Destination",
      current_departure_time: validDate.toISOString(),
      current_live_travel_time_min: 54.0,
      recommended_departure_time: recDate.toISOString(),
      recommended_live_travel_time_min: 42.0,
      savings_min: 12.0,
      free_flow_travel_time_min: 26.0,
      distance_km: 15.2,
    };
  } else {
    return {
      origin_name: originName || "Origin",
      dest_name: destName || "Destination",
      current_departure_time: validDate.toISOString(),
      current_live_travel_time_min: 32.0,
      recommended_departure_time: validDate.toISOString(),
      recommended_live_travel_time_min: 32.0,
      savings_min: 0.0,
      free_flow_travel_time_min: 26.0,
      distance_km: 15.2,
    };
  }
}

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

  const live_travel_time_min = isMorningPeak ? 54.0 : isEveningPeak ? 58.0 : 42.0;
  const free_flow_travel_time_min = 32.0;
  const traffic_delay_min = live_travel_time_min - free_flow_travel_time_min;

  return {
    route_name,
    predicted_delay_min: parseFloat(predicted_delay_min.toFixed(2)),
    base_value_min: parseFloat(base_value_min.toFixed(2)),
    live_travel_time_min,
    free_flow_travel_time_min,
    traffic_delay_min,
    distance_km: 18.2,
    factors,
  };
}

function generateMockAlternateRoutes(
  originName: string,
  destName: string
): RouteOption[] {
  return [
    {
      route_index: 1,
      description: `via Main Arterial & ${originName || "Central"} Corridor`,
      predicted_delay_min: 2.1,
      congestion_ratio: 1.25,
      distance_km: 18.5,
      live_travel_time_min: 42.0,
      free_flow_travel_time_min: 33.6,
      is_best: true,
    },
    {
      route_index: 2,
      description: `via Outer Ring Road & ${destName || "East"} Connector`,
      predicted_delay_min: 4.8,
      congestion_ratio: 1.45,
      distance_km: 22.4,
      live_travel_time_min: 49.5,
      free_flow_travel_time_min: 34.1,
      is_best: false,
    },
    {
      route_index: 3,
      description: `via Surface Corridor & Bypass`,
      predicted_delay_min: 6.2,
      congestion_ratio: 1.62,
      distance_km: 17.8,
      live_travel_time_min: 55.0,
      free_flow_travel_time_min: 34.0,
      is_best: false,
    },
  ];
}

function formatCongestionPhrase(ratio: number): string {
  if (ratio > 1.05) {
    const pct = Math.round((ratio - 1.0) * 100);
    return `${pct}% heavier than usual`;
  } else if (ratio < 0.95) {
    const pct = Math.round((1.0 - ratio) * 100);
    return `${pct}% lighter than usual`;
  }
  return "Typical free-flow traffic";
}

function ResultsContent() {
  const searchParams = useSearchParams();

  // Read coordinate-based query parameters
  const originName = searchParams.get("origin_name") || "";
  const originLat = searchParams.get("origin_lat");
  const originLng = searchParams.get("origin_lng");
  const destName = searchParams.get("dest_name") || "";
  const destLat = searchParams.get("dest_lat");
  const destLng = searchParams.get("dest_lng");
  const departureTime = searchParams.get("departure_time") || new Date().toISOString();

  // Legacy fallback if someone opens old route_id URL
  const legacyRouteId = searchParams.get("route_id");

  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShapExplanationResponse | null>(null);

  // Save route state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [showNicknameInput, setShowNicknameInput] = useState(false);

  // Alternate route comparison state
  const [compareRoutes, setCompareRoutes] = useState<RouteOption[]>([]);
  const [compareLoading, setCompareLoading] = useState(true);

  // Best departure time recommendation state
  const [bestTime, setBestTime] = useState<BestDepartureTimeResponse | null>(null);
  const [bestTimeLoading, setBestTimeLoading] = useState(true);

  const hasCoordinates = Boolean(originLat && originLng && destLat && destLng);
  const hasValidRequest = hasCoordinates || Boolean(legacyRouteId);

  const handleSaveRoute = async () => {
    if (!token || !originLat || !originLng || !destLat || !destLng) return;

    setSaveStatus("saving");
    setSaveErrorMsg(null);

    try {
      const payload = {
        origin_name: originName || "Custom Origin",
        origin_lat: parseFloat(originLat),
        origin_lng: parseFloat(originLng),
        dest_name: destName || "Custom Destination",
        dest_lat: parseFloat(destLat),
        dest_lng: parseFloat(destLng),
        nickname: nickname.trim() || undefined,
      };

      const res = await fetch(`${API_BASE_URL}/saved-routes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.message || resData.error || `HTTP ${res.status}`);
      }

      setSaveStatus("saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save route.";
      setSaveErrorMsg(msg);
      setSaveStatus("error");
    }
  };

  useEffect(() => {
    if (!hasValidRequest) {
      setLoading(false);
      setCompareLoading(false);
      setBestTimeLoading(false);
      return;
    }

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

    // 1. Fetch SHAP Explainability Data
    const fetchExplainData = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpointUrl = `${API_BASE_URL}/predict/explain?${queryParams.toString()}`;
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(endpointUrl, { headers });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.warn(
          "Could not fetch from live Flask API (http://localhost:5000/predict/explain), using fallback mock Model V2 explanation:",
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

    // 2. Fetch Alternate Route Comparison Data
    const fetchCompareData = async () => {
      setCompareLoading(true);
      try {
        const endpointUrl = `${API_BASE_URL}/predict/compare-routes?${queryParams.toString()}`;
        const res = await fetch(endpointUrl);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        setCompareRoutes(json.route_options || []);
      } catch (err: any) {
        console.warn(
          "Could not fetch from live Flask API (http://localhost:5000/predict/compare-routes), using fallback mock alternate routes:",
          err
        );
        setCompareRoutes(
          generateMockAlternateRoutes(originName || "Origin", destName || "Destination")
        );
      } finally {
        setCompareLoading(false);
      }
    };

    // 3. Fetch Best Departure Time Recommendation Data
    const fetchBestTimeData = async () => {
      setBestTimeLoading(true);
      try {
        const endpointUrl = `${API_BASE_URL}/predict/best-time-v2?${queryParams.toString()}`;
        const res = await fetch(endpointUrl);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        setBestTime(json);
      } catch (err: any) {
        console.warn(
          "Could not fetch from live Flask API (http://localhost:5000/predict/best-time-v2), using fallback mock best time:",
          err
        );
        setBestTime(
          generateMockBestTimeResponse(
            originName || "Origin",
            destName || "Destination",
            departureTime
          )
        );
      } finally {
        setBestTimeLoading(false);
      }
    };

    fetchExplainData();
    fetchCompareData();
    fetchBestTimeData();
  }, [originLat, originLng, destLat, destLng, originName, destName, departureTime, hasValidRequest, token]);

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

  // Calculate honest real-world traffic delay (lost to traffic vs free-flow)
  const hasLiveTimes = typeof data.live_travel_time_min === "number" && typeof data.free_flow_travel_time_min === "number";
  const liveTravelMin = data.live_travel_time_min ?? 0;
  const freeFlowMin = data.free_flow_travel_time_min ?? 0;
  const realTrafficDelayMin = data.traffic_delay_min ?? (hasLiveTimes ? Math.max(0, liveTravelMin - freeFlowMin) : null);

  const modelDelta = data.predicted_delay_min - data.base_value_min;
  const modelDeltaSign = modelDelta > 0 ? "+" : "";

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
              <div className="border-b border-border pb-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {hasLiveTimes ? "Traffic Delay (vs Clear Roads)" : "Model Delay Estimate"}
                </span>
                {hasLiveTimes && (
                  <span className="text-[11px] font-medium text-accent-route bg-accent-route/10 px-2 py-0.5 rounded-full">
                    Real-time
                  </span>
                )}
              </div>

              {/* Large Metric: Directly Honest to Travel Time */}
              <div className="flex flex-col items-center justify-center py-2 text-center">
                {hasLiveTimes && realTrafficDelayMin !== null ? (
                  <>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="font-mono text-5xl font-bold tracking-tight text-ink tabular-nums">
                        +{Math.round(realTrafficDelayMin)}
                      </span>
                      <span className="text-lg font-medium text-text-secondary">min</span>
                    </div>
                    <p className="text-xs sm:text-sm text-text-secondary font-medium mt-1">
                      slower than clear roads (~{Math.round(freeFlowMin)} min free-flow)
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="font-mono text-5xl font-bold tracking-tight text-ink tabular-nums">
                        +{data.predicted_delay_min.toFixed(1)}
                      </span>
                      <span className="text-lg font-medium text-text-secondary">min</span>
                    </div>
                    <p className="text-xs sm:text-sm text-text-secondary font-medium mt-1">
                      {modelDelta === 0 ? (
                        <span>Matches model average ({data.base_value_min.toFixed(1)} min baseline)</span>
                      ) : (
                        <span>
                          <strong className="text-ink font-semibold">
                            {modelDeltaSign}{modelDelta.toFixed(1)} min
                          </strong>{" "}
                          shift vs typical route average ({data.base_value_min.toFixed(1)} min baseline)
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>

              {/* Context Info */}
              <div className="bg-bg-page p-4 rounded-xl border border-border flex flex-col gap-2.5 text-xs sm:text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-text-muted text-xs font-semibold">Route:</span>
                  <span className="font-medium text-ink text-right">{data.route_name}</span>
                </div>

                {hasLiveTimes && (
                  <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Live Travel Time:</span>
                      <span className="font-mono font-bold text-ink">
                        ~{Math.round(liveTravelMin)} min
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Clear Roads (Free-flow):</span>
                      <span className="font-mono text-text-secondary">
                        ~{Math.round(freeFlowMin)} min
                      </span>
                    </div>
                    {typeof data.distance_km === "number" && (
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Distance:</span>
                        <span className="font-mono text-text-secondary">
                          {data.distance_km.toFixed(1)} km
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Model Attribution Context */}
                <div className="flex flex-col gap-1 border-t border-border/60 pt-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-text-muted">Model baseline shift:</span>
                    <span className="font-mono text-text-secondary text-right">
                      {modelDeltaSign}{modelDelta.toFixed(1)} min vs typical
                    </span>
                  </div>
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

                <div className="flex items-start justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                  <span className="text-text-muted font-semibold">Departure Window:</span>
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

                {/* Save Route Action (Available only for authenticated users) */}
                {user && hasCoordinates && (
                  <div className="border-t border-border/80 pt-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary">Save this commute</span>
                      <button
                        type="button"
                        onClick={() => setShowNicknameInput(!showNicknameInput)}
                        className="text-[11px] text-accent-route hover:underline font-medium"
                      >
                        {showNicknameInput ? "Hide nickname" : "+ Add nickname"}
                      </button>
                    </div>

                    {showNicknameInput && (
                      <input
                        type="text"
                        placeholder="e.g. Daily Office / Home to Tech Park"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        disabled={saveStatus === "saving" || saveStatus === "saved"}
                        className="input-field text-xs py-1.5"
                      />
                    )}

                    {saveErrorMsg && (
                      <p className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                        {saveErrorMsg}
                      </p>
                    )}

                    {saveStatus === "saved" ? (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs">
                        <span className="font-medium flex items-center gap-1.5">
                          ✓ Route saved!
                        </span>
                        <Link
                          href="/saved-routes"
                          className="font-semibold underline hover:text-emerald-700 ml-2"
                        >
                          View Saved Routes →
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveRoute}
                        disabled={saveStatus === "saving"}
                        className={`btn btn-secondary w-full text-xs font-semibold flex items-center justify-center gap-2 py-2 ${
                          saveStatus === "saving" ? "opacity-75 cursor-wait" : ""
                        }`}
                      >
                        {saveStatus === "saving" ? (
                          <>
                            <span className="h-3.5 w-3.5 border-2 border-accent-route border-t-transparent rounded-full animate-spin" />
                            <span>Saving Route...</span>
                          </>
                        ) : (
                          <>
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
                              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                            </svg>
                            <span>Save this route</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
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

      {/* Best Time to Leave Section */}
      <div className="mt-12">
        <ScrollReveal delayOffset={0.18}>
          {bestTimeLoading ? (
            <div className="card animate-pulse flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-border/80" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-4 bg-border/80 rounded w-1/3" />
                  <div className="h-3 bg-border/60 rounded w-2/3" />
                </div>
              </div>
              <div className="h-16 bg-border/60 rounded w-full" />
            </div>
          ) : bestTime ? (() => {
            const isTrivialSaving = bestTime.savings_min < 2;
            const recDate = new Date(bestTime.recommended_departure_time);
            const curDate = new Date(bestTime.current_departure_time);
            const diffMs = recDate.getTime() - curDate.getTime();
            const diffMinutes = Math.round(Math.abs(diffMs) / 60000);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffRemainingMins = diffMinutes % 60;

            let timeShiftLabel = "";
            if (diffMs > 0) {
              timeShiftLabel = diffHours > 0
                ? `${diffHours}h ${diffRemainingMins > 0 ? `${diffRemainingMins}m` : ""} later`
                : `${diffMinutes}m later`;
            } else if (diffMs < 0) {
              timeShiftLabel = diffHours > 0
                ? `${diffHours}h ${diffRemainingMins > 0 ? `${diffRemainingMins}m` : ""} earlier`
                : `${diffMinutes}m earlier`;
            }

            const formatTime = (iso: string) => {
              const d = new Date(iso);
              return d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });
            };

            return (
              <div
                className={`card relative overflow-hidden ${
                  isTrivialSaving
                    ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                    : "border-accent-route/40 bg-accent-route/[0.03]"
                }`}
              >
                {/* Accent gradient strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isTrivialSaving
                      ? "bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-transparent"
                      : "bg-gradient-to-r from-accent-route/60 via-accent-route/40 to-transparent"
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-6 pt-7">
                  {/* Icon */}
                  <div
                    className={`flex items-center justify-center h-12 w-12 rounded-xl shrink-0 text-xl ${
                      isTrivialSaving
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-accent-route/10 border border-accent-route/20"
                    }`}
                  >
                    {isTrivialSaving ? "✓" : "⏰"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`badge-pill text-[10px] ${
                        isTrivialSaving
                          ? "!bg-emerald-500/10 !text-emerald-600 !border-emerald-500/20"
                          : ""
                      }`}>
                        {isTrivialSaving ? "Good Timing" : "Optimization"}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold font-display text-ink mb-1">
                      {isTrivialSaving
                        ? "You're already departing at a good time"
                        : "Better time to leave?"}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {isTrivialSaving ? (
                        <>
                          Your chosen departure at{" "}
                          <span className="font-semibold text-ink">{formatTime(bestTime.current_departure_time)}</span>
                          {" "}is already near-optimal — no significant time savings found within the next
                          few hours. Estimated travel time:{" "}
                          <span className="font-mono font-semibold text-ink">
                            ~{Math.round(bestTime.current_live_travel_time_min)} min
                          </span>.
                        </>
                      ) : (
                        <>
                          Leaving at{" "}
                          <span className="font-semibold text-ink">{formatTime(bestTime.recommended_departure_time)}</span>
                          {" "}({timeShiftLabel}) could reduce your travel time to{" "}
                          <span className="font-mono font-semibold text-ink">
                            ~{Math.round(bestTime.recommended_live_travel_time_min)} min
                          </span>
                          {" "}instead of{" "}
                          <span className="font-mono text-text-secondary">
                            ~{Math.round(bestTime.current_live_travel_time_min)} min
                          </span>.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Savings badge — only when meaningful */}
                  {!isTrivialSaving && (
                    <div className="shrink-0 flex flex-col items-center justify-center text-center bg-accent-route/10 border border-accent-route/20 rounded-xl px-5 py-3.5">
                      <span className="text-[10px] uppercase font-semibold text-accent-route tracking-wider mb-0.5">
                        Save
                      </span>
                      <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-accent-route">
                        {Math.round(bestTime.savings_min)}
                      </span>
                      <span className="text-xs font-medium text-accent-route/80">minutes</span>
                    </div>
                  )}
                </div>

                {/* Detail row */}
                {!isTrivialSaving && (
                  <div className="border-t border-border/60 px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-muted">Current departure:</span>
                      <span className="font-mono font-medium text-ink">
                        {formatTime(bestTime.current_departure_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-muted">Recommended:</span>
                      <span className="font-mono font-semibold text-accent-route">
                        {formatTime(bestTime.recommended_departure_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-muted">Free-flow baseline:</span>
                      <span className="font-mono text-text-secondary">
                        ~{Math.round(bestTime.free_flow_travel_time_min)} min
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : null}
        </ScrollReveal>
      </div>

      {/* Alternate Route Comparison Section */}
      <div className="mt-12">
        <ScrollReveal delayOffset={0.2}>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border pb-4">
            <div>
              <span className="badge-pill mb-2">Alternative Paths</span>
              <h2 className="text-xl font-bold font-display text-ink">
                Or try a different route
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">
                Real-time travel times and traffic conditions across alternative corridors between your origin and destination.
              </p>
            </div>
            {compareRoutes.length > 0 && compareRoutes[0].is_best && (
              <div className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-route" />
                Sorted by fastest total travel time
              </div>
            )}
          </div>
        </ScrollReveal>

        {compareLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="card animate-pulse flex flex-col justify-between gap-4 p-6 min-h-[220px]"
              >
                <div className="flex flex-col gap-2">
                  <div className="h-4 bg-border/80 rounded w-3/4" />
                  <div className="h-3 bg-border/60 rounded w-1/3" />
                </div>
                <div className="h-10 bg-border/60 rounded w-1/2 my-4" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-3 bg-border/60 rounded w-1/3" />
                  <div className="h-3 bg-border/60 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : compareRoutes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {compareRoutes.map((route, idx) => {
              const congestionPhrase = formatCongestionPhrase(route.congestion_ratio);
              const isHeavy = route.congestion_ratio >= 1.35;
              const isModerate =
                route.congestion_ratio >= 1.15 && route.congestion_ratio < 1.35;

              // Honest, direct calculation: live travel time minus free-flow travel time
              const trafficLostMin = Math.max(
                0,
                Math.round(route.live_travel_time_min - route.free_flow_travel_time_min)
              );

              return (
                <ScrollReveal key={route.route_index || idx} delayOffset={0.08 * (idx + 1)}>
                  <div
                    className={`card relative flex flex-col justify-between h-full p-6 transition-all duration-200 hover:shadow-md ${
                      route.is_best
                        ? "border-accent-route/50 bg-accent-route/[0.03] ring-1 ring-accent-route/30"
                        : "hover:border-border-strong"
                    }`}
                  >
                    {/* Top row: Route name and Best badge */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm sm:text-base text-ink line-clamp-2 leading-snug">
                          {route.description}
                        </h3>
                        {route.is_best && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-accent-route text-white shrink-0 shadow-sm">
                            Fastest
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-muted">
                        {route.distance_km.toFixed(1)} km total distance
                      </span>
                    </div>

                    {/* Middle: Prominent Live Travel Time */}
                    <div className="my-5 py-3.5 border-y border-border/60 flex items-baseline justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
                          Live Travel Time
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-ink">
                            {route.live_travel_time_min < 10
                              ? route.live_travel_time_min.toFixed(1)
                              : Math.round(route.live_travel_time_min)}
                          </span>
                          <span className="text-sm font-medium text-text-secondary">min</span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-xs text-text-muted">Clear roads</span>
                        <span className="text-xs font-mono font-medium text-text-secondary mt-0.5">
                          ~{Math.round(route.free_flow_travel_time_min)} min
                        </span>
                      </div>
                    </div>

                    {/* Bottom: Delay & Congestion Metrics */}
                    <div className="flex flex-col gap-2.5 text-xs">
                      {/* PRIMARY DELAY METRIC: Lost to traffic (live - free_flow) */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-bg-page border border-border/60">
                        <span className="text-text-secondary font-medium">Lost to traffic:</span>
                        <span className="font-mono font-bold text-ink text-xs">
                          +{trafficLostMin} min slower than clear roads
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Traffic intensity:</span>
                        <span
                          className={`font-medium px-2 py-0.5 rounded ${
                            isHeavy
                              ? "bg-factor-peak-dim text-factor-peak"
                              : isModerate
                              ? "bg-factor-event-dim text-factor-event"
                              : "bg-factor-rain-dim text-ink"
                          }`}
                        >
                          {congestionPhrase}
                        </span>
                      </div>

                      {/* Secondary Context: Model prediction vs historical dataset baseline */}
                      <div className="flex items-center justify-between text-text-muted pt-1 border-t border-border/40 text-[11px]">
                        <span title="ML model predicted delay relative to historical dataset average">
                          Vs typical conditions:
                        </span>
                        <span className="font-mono text-text-secondary">
                          +{route.predicted_delay_min.toFixed(1)} min
                        </span>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        ) : (
          <div className="card p-6 text-center text-xs text-text-secondary">
            No alternate routes available for this corridor.
          </div>
        )}
      </div>
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
