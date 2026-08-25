"use client";

import { PredictionResponse, ConfidenceLevel } from "@/types/prediction";

interface DelayPredictionProps {
  prediction: PredictionResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  high: {
    label: "High confidence",
    bg: "rgba(31, 168, 160, 0.08)",
    text: "var(--color-factor-rain)",
    border: "rgba(31, 168, 160, 0.3)",
    dot: "var(--color-factor-rain)",
  },
  medium: {
    label: "Medium confidence",
    bg: "rgba(232, 163, 61, 0.08)",
    text: "var(--color-factor-peak)",
    border: "rgba(232, 163, 61, 0.3)",
    dot: "var(--color-factor-peak)",
  },
  low: {
    label: "Low confidence",
    bg: "rgba(107, 114, 128, 0.08)",
    text: "var(--color-text-secondary)",
    border: "rgba(107, 114, 128, 0.3)",
    dot: "var(--color-text-muted)",
  },
};

function formatDepartureTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function DelayPrediction({
  prediction,
  loading,
  error,
  onRetry,
}: DelayPredictionProps) {
  // 1. Loading State (Skeleton matching .card styling)
  if (loading) {
    return (
      <div className="card flex flex-col gap-5 animate-pulse" aria-busy="true">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="h-4 bg-border/60 rounded w-1/3" />
          <div className="h-5 bg-border/40 rounded-full w-24" />
        </div>

        {/* Large Metric Skeleton */}
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="h-12 bg-border/60 rounded-lg w-40" />
          <div className="h-4 bg-border/40 rounded w-52" />
        </div>

        {/* Details Skeleton */}
        <div className="bg-bg-page p-4 rounded-xl border border-border flex flex-col gap-2.5">
          <div className="h-3.5 bg-border/50 rounded w-3/4" />
          <div className="h-3 bg-border/40 rounded w-1/2" />
          <div className="h-3 bg-border/40 rounded w-2/3" />
        </div>
      </div>
    );
  }

  // 2. Error State with Retry Button
  if (error) {
    return (
      <div className="card border-border bg-bg-surface flex flex-col items-center text-center p-6 sm:p-8">
        <div className="w-12 h-12 rounded-full bg-accent-route-dim flex items-center justify-center text-xl mb-3 text-text-secondary">
          ⚠️
        </div>
        <h3 className="text-base font-semibold text-ink mb-1.5">
          Unable to generate prediction
        </h3>
        <p className="text-xs sm:text-sm text-text-secondary max-w-sm mb-5 leading-relaxed">
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary text-xs sm:text-sm py-2 px-4 inline-flex items-center gap-1.5"
        >
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
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span>Try again</span>
        </button>
      </div>
    );
  }

  // 3. No Prediction State (Initial state before submission)
  if (!prediction) {
    return null;
  }

  // 4. Active Prediction Display
  const delta = prediction.predicted_delay_min - prediction.baseline_delay_min;
  const deltaSign = delta > 0 ? "+" : "";
  const confidence = CONFIDENCE_CONFIG[prediction.confidence] || CONFIDENCE_CONFIG.medium;

  return (
    <div className="card flex flex-col gap-5 transition-all">
      {/* Header bar: Title + Calm Confidence Badge */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Predicted Delay
        </span>
        <span
          className="badge-pill text-xs py-0.5 px-2.5 font-medium flex items-center gap-1.5"
          style={{
            background: confidence.bg,
            color: confidence.text,
            borderColor: confidence.border,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: confidence.dot }}
          />
          {confidence.label}
        </span>
      </div>

      {/* Main Focal Metric */}
      <div className="flex flex-col items-center justify-center py-3 text-center">
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-ink tabular-nums">
            +{prediction.predicted_delay_min}
          </span>
          <span className="text-base sm:text-lg font-medium text-text-secondary">
            min
          </span>
        </div>

        {/* Delta vs Baseline Comparison */}
        <p className="text-xs sm:text-sm text-text-secondary font-medium mt-1">
          {delta === 0 ? (
            <span>Same as historical average ({prediction.baseline_delay_min} min baseline)</span>
          ) : (
            <span>
              <strong className="text-ink font-semibold">
                {deltaSign}{delta} min
              </strong>{" "}
              vs. historical average ({prediction.baseline_delay_min} min baseline)
            </span>
          )}
        </p>
      </div>

      {/* Context Details Card */}
      <div className="bg-bg-page p-4 rounded-xl border border-border flex flex-col gap-2.5 text-xs sm:text-sm">
        <div className="flex items-start justify-between gap-2">
          <span className="text-text-muted text-xs">Route Corridor:</span>
          <span className="font-medium text-ink text-right">
            {prediction.route_name}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="text-text-muted text-xs">Path Variant:</span>
          <span className="font-medium text-ink text-right truncate max-w-[200px] sm:max-w-[240px]">
            {prediction.path_variant}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="text-text-muted text-xs">Departure Time:</span>
          <span className="font-mono text-ink text-right">
            {formatDepartureTime(prediction.departure_time)}
          </span>
        </div>
      </div>
    </div>
  );
}
