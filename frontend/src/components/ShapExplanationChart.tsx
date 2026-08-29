"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export interface ShapFactor {
  name: string;
  value: any;
  shap_value_min: number;
  category: "temporal" | "weather" | "event" | "historical" | "live_traffic";
}

interface ShapExplanationChartProps {
  factors: ShapFactor[];
  predictedDelayMin?: number;
  baseValueMin?: number;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Translates raw feature names and values into friendly human-readable descriptions.
 */
function translateFactor(f: ShapFactor): {
  axisLabel: string;
  displayValue: string;
  tooltipTitle: string;
} | null {
  const name = f.name;
  const val = f.value;
  const nameLower = name.toLowerCase().trim();

  // 1. Remove redundant "Weekend indicator" entirely
  if (nameLower === "weekend indicator" || nameLower === "is_weekend") {
    return null;
  }

  // 2. Remove "Event proximity" if distance is 999km or no event
  if (nameLower === "event proximity" || nameLower === "distance_to_event_km") {
    if (val === 999 || Number(val) >= 900 || val === null || val === undefined) {
      return null;
    }
  }

  // 3. Nearby public event
  if (nameLower === "nearby public event" || nameLower === "has_event") {
    const hasEvent = Boolean(
      val && val !== 0 && val !== "0" && val !== false && val !== "False"
    );
    return {
      axisLabel: hasEvent ? "Nearby Event: Active" : "Nearby Events: None",
      displayValue: hasEvent ? "Active public event nearby" : "No nearby events",
      tooltipTitle: "Nearby Public Events",
    };
  }

  // 4. Day of week translation (0=Mon, ..., 6=Sun) - specific check only
  if (nameLower === "day of week" || nameLower === "day_of_week") {
    let dayName = "Weekday";
    if (typeof val === "string" && DAYS_OF_WEEK.includes(val)) {
      dayName = val;
    } else {
      const dayIdx = Number(val);
      if (!isNaN(dayIdx) && dayIdx >= 0 && dayIdx < 7) {
        dayName = DAYS_OF_WEEK[dayIdx];
      } else {
        dayName = String(val);
      }
    }
    return {
      axisLabel: `Day: ${dayName}`,
      displayValue: dayName,
      tooltipTitle: "Day of Week",
    };
  }

  // 5. Live congestion ratio
  if (nameLower === "live congestion ratio" || nameLower === "congestion_ratio") {
    const num = Number(val);
    let desc = "Normal traffic";
    if (!isNaN(num)) {
      if (num > 1.05) {
        const pct = Math.round((num - 1.0) * 100);
        desc = `+${pct}% heavier`;
      } else if (num < 0.95) {
        const pct = Math.round((1.0 - num) * 100);
        desc = `${pct}% lighter`;
      } else {
        desc = "Normal flow";
      }
    }
    const fullDesc = !isNaN(num)
      ? num > 1.05
        ? `Traffic is ${Math.round((num - 1.0) * 100)}% heavier than usual`
        : num < 0.95
        ? `Traffic is ${Math.round((1.0 - num) * 100)}% lighter than usual`
        : "Normal free-flow traffic"
      : `${val}x`;

    return {
      axisLabel: `Live Traffic: ${desc}`,
      displayValue: fullDesc,
      tooltipTitle: "Live Traffic Congestion",
    };
  }

  // 6. Time of day
  if (nameLower === "time of day" || nameLower === "time") {
    return {
      axisLabel: `Time: ${val}`,
      displayValue: String(val),
      tooltipTitle: "Time of Day",
    };
  }

  // 7. Weather condition
  if (nameLower === "weather condition" || nameLower === "condition") {
    const cond = val ? String(val) : "Clear";
    return {
      axisLabel: `Weather: ${cond}`,
      displayValue: cond,
      tooltipTitle: "Weather Condition",
    };
  }

  // 8. Precipitation / Rain
  if (
    nameLower === "precipitation" ||
    nameLower === "rainfall_mm" ||
    nameLower === "rainfall"
  ) {
    const num = Number(val);
    const hasRain = !isNaN(num) && num > 0;
    return {
      axisLabel: hasRain ? `Rain: ${num.toFixed(1)} mm` : "Rain: No rain",
      displayValue: hasRain ? `${num.toFixed(1)} mm precipitation` : "No rain (0.0 mm)",
      tooltipTitle: "Precipitation",
    };
  }

  // 9. Temperature
  if (nameLower === "temperature") {
    const num = Number(val);
    const tempStr = !isNaN(num) ? `${num.toFixed(1)}°C` : `${val}°C`;
    return {
      axisLabel: `Temp: ${tempStr}`,
      displayValue: tempStr,
      tooltipTitle: "Temperature",
    };
  }

  // 10. Visibility
  if (nameLower === "visibility") {
    const num = Number(val);
    const km = !isNaN(num) ? (num > 100 ? num / 1000 : num) : 10.0;
    const desc = km >= 8 ? "Clear" : km >= 4 ? "Moderate" : "Low";
    return {
      axisLabel: `Visibility: ${km.toFixed(1)} km`,
      displayValue: `Clear visibility (${km.toFixed(1)} km)`,
      tooltipTitle: "Visibility",
    };
  }

  // 11. Holiday indicator
  if (nameLower === "holiday indicator" || nameLower === "is_holiday") {
    const isHoliday = Boolean(
      val && val !== 0 && val !== "0" && val !== false && val !== "False"
    );
    return {
      axisLabel: isHoliday ? "Holiday: Public Holiday" : "Holiday: No holiday",
      displayValue: isHoliday ? "Public Holiday" : "No holiday (regular working day)",
      tooltipTitle: "Holiday Status",
    };
  }

  // Fallback
  return {
    axisLabel: `${name}: ${val ?? "N/A"}`,
    displayValue: String(val ?? "N/A"),
    tooltipTitle: name,
  };
}

/**
 * Generates a concise plain-language summary based on delay and the top contributing SHAP factor.
 */
function generatePlainLanguageSummary(
  topFactor: ShapFactor | null,
  predictedDelayMin?: number,
  baseValueMin?: number
): string {
  if (!topFactor) {
    return "Your commute delay is expected to be typical for this corridor.";
  }

  const delayText =
    predictedDelayMin !== undefined && predictedDelayMin > 0
      ? `take about ${Math.round(predictedDelayMin)} minutes longer than usual`
      : "experience minimal traffic delay";

  // Translate top factor into a clear phrase
  let factorPhrase = "current traffic conditions";
  const nameLower = topFactor.name.toLowerCase().trim();
  const category = topFactor.category;
  const isPositive = topFactor.shap_value_min >= 0;

  if (category === "live_traffic") {
    factorPhrase = isPositive
      ? "heavier than usual live traffic"
      : "lighter than usual road congestion";
  } else if (category === "temporal") {
    if (nameLower === "time of day" || nameLower === "time") {
      factorPhrase = "the time of day peak commute pattern";
    } else if (nameLower === "day of week" || nameLower === "day_of_week") {
      factorPhrase = "day-of-the-week traffic flow";
    } else if (nameLower === "holiday indicator" || nameLower === "is_holiday") {
      factorPhrase = "holiday traffic schedules";
    } else {
      factorPhrase = "departure timing";
    }
  } else if (category === "weather") {
    if (
      nameLower === "precipitation" ||
      nameLower === "rainfall_mm" ||
      nameLower === "rainfall"
    ) {
      factorPhrase = "rain and wet road conditions";
    } else {
      factorPhrase = "current weather conditions";
    }
  } else if (category === "event") {
    factorPhrase = "a nearby public event";
  } else if (category === "historical") {
    factorPhrase = "typical corridor historical trends";
  }

  return `Your trip will ${delayText}, mainly due to ${factorPhrase}.`;
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case "live_traffic":
      return "var(--color-accent-route)";
    case "weather":
      return "var(--color-factor-rain)";
    case "temporal":
      return "var(--color-factor-peak)";
    case "event":
      return "var(--color-factor-event)";
    case "historical":
      return "var(--color-factor-historical)";
    default:
      return "var(--color-text-secondary)";
  }
};

const getCategoryBgColor = (category: string) => {
  switch (category) {
    case "live_traffic":
      return "var(--color-accent-route-dim)";
    case "weather":
      return "var(--color-factor-rain-dim)";
    case "temporal":
      return "var(--color-factor-peak-dim)";
    case "event":
      return "var(--color-factor-event-dim)";
    case "historical":
      return "var(--color-factor-historical-dim)";
    default:
      return "rgba(107, 114, 128, 0.05)";
  }
};

export default function ShapExplanationChart({
  factors,
  predictedDelayMin,
  baseValueMin,
}: ShapExplanationChartProps) {
  const [isAnimationActive, setIsAnimationActive] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsAnimationActive(!mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setIsAnimationActive(!e.matches);
    };
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Process, filter, and translate factors
  const processedData = useMemo(() => {
    const list: Array<
      ShapFactor & {
        axisLabel: string;
        displayValue: string;
        tooltipTitle: string;
        shapValue: number;
      }
    > = [];

    for (const f of factors) {
      const translated = translateFactor(f);
      if (!translated) continue;

      list.push({
        ...f,
        axisLabel: translated.axisLabel,
        displayValue: translated.displayValue,
        tooltipTitle: translated.tooltipTitle,
        shapValue: f.shap_value_min,
      });
    }

    // Sort by absolute SHAP contribution descending
    list.sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));
    return list;
  }, [factors]);

  // Top factor for plain language summary
  const topFactor = processedData.length > 0 ? processedData[0] : null;
  const summarySentence = useMemo(
    () => generatePlainLanguageSummary(topFactor, predictedDelayMin, baseValueMin),
    [topFactor, predictedDelayMin, baseValueMin]
  );

  // Visible factors based on showAll toggle (default top 5)
  const visibleData = showAll ? processedData : processedData.slice(0, 5);

  // Calculate clean, rounded symmetrical bounds for X-axis
  const maxAbs = Math.max(...visibleData.map((d) => Math.abs(d.shapValue)), 1);
  const niceMax = Math.max(Math.ceil(maxAbs * 1.25), 2);
  const xDomain = [-niceMax, niceMax];

  // Custom label on the end of each bar
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value === undefined || value === null) return null;

    const num = Number(value);
    const isZero = Math.abs(num) < 0.05;
    const isPositive = num > 0;
    const textAnchor = isZero ? "start" : isPositive ? "start" : "end";
    const offset = isZero ? 6 : isPositive ? 8 : -8;
    const labelX = isZero ? x + offset : isPositive ? x + width + offset : x + offset;
    const labelY = y + height / 2 + 4;

    return (
      <text
        x={labelX}
        y={labelY}
        textAnchor={textAnchor}
        fill={isZero ? "var(--color-text-muted)" : "var(--color-ink)"}
        className="font-mono font-semibold text-[11px]"
      >
        {isZero ? "0.0 min" : `${isPositive ? "+" : ""}${num.toFixed(1)} min`}
      </text>
    );
  };

  const chartHeight = Math.max(visibleData.length * 52 + 50, 240);

  return (
    <div className="w-full flex flex-col gap-5">
      {/* 1. Plain-language summary banner */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-accent-route-dim/20 border border-accent-route/30 flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">💡</span>
        <div className="flex flex-col gap-0.5 text-xs sm:text-sm">
          <span className="font-semibold text-ink">Summary</span>
          <p className="text-text-primary leading-relaxed">{summarySentence}</p>
        </div>
      </div>

      {/* 2. Category Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-3 border-b border-border text-xs font-medium text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-route" />
          <span>Live Traffic</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-factor-peak" />
          <span>Time / Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-factor-rain" />
          <span>Weather</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-factor-event" />
          <span>Events</span>
        </div>
      </div>

      {/* 3. Recharts Horizontal Bar Chart */}
      <div style={{ height: `${chartHeight}px`, width: "100%", outline: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={visibleData}
            layout="vertical"
            margin={{ top: 8, right: 45, left: 10, bottom: 8 }}
            barCategoryGap={10}
          >
            <XAxis
              type="number"
              domain={xDomain}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--color-text-secondary)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
              tickFormatter={(val: number) => {
                const rounded = Math.round(val);
                if (rounded === 0) return "0";
                return `${rounded > 0 ? "+" : ""}${rounded} min`;
              }}
            />
            <YAxis
              type="category"
              dataKey="axisLabel"
              width={200}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--color-ink)",
                fontSize: 12,
                fontWeight: 500,
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(28, 34, 51, 0.03)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as (typeof visibleData)[0];
                  const sign = data.shapValue > 0 ? "+" : "";
                  return (
                    <div className="bg-bg-surface border border-border px-3.5 py-3 rounded-xl shadow-lg flex flex-col gap-1.5 text-xs max-w-xs">
                      <span className="font-semibold text-ink text-sm">
                        {data.tooltipTitle}
                      </span>
                      <div className="flex items-center justify-between gap-4 mt-0.5">
                        <span className="text-text-secondary">Observed:</span>
                        <span className="font-medium text-ink bg-bg-page px-2 py-0.5 rounded border border-border">
                          {data.displayValue}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 mt-1 border-t border-border/60 pt-1.5">
                        <span className="text-text-secondary font-medium">
                          Impact on delay:
                        </span>
                        <span
                          className="font-mono font-bold px-2 py-0.5 rounded text-xs"
                          style={{
                            color: getCategoryColor(data.category),
                            backgroundColor: getCategoryBgColor(data.category),
                          }}
                        >
                          {sign}
                          {data.shapValue.toFixed(1)} min
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              x={0}
              stroke="var(--color-border)"
              strokeWidth={1.5}
            />
            <Bar dataKey="shapValue" isAnimationActive={isAnimationActive}>
              {visibleData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getCategoryColor(entry.category)}
                />
              ))}
              <LabelList dataKey="shapValue" content={renderCustomLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Show All / Show Less Toggle Button */}
      {processedData.length > 5 && (
        <div className="flex justify-center -mt-2">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-route hover:text-accent-route/80 bg-accent-route-dim px-3 py-1.5 rounded-full transition-colors"
          >
            <span>
              {showAll
                ? "Show top 5 factors only"
                : `Show all ${processedData.length} factors (${processedData.length - 5} more)`}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${showAll ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      {/* 5. Subtitle hint */}
      <div className="text-center text-[11px] text-text-muted">
        Positive factors (+) add delay. Negative factors (-) reduce delay relative to baseline.
      </div>
    </div>
  );
}
