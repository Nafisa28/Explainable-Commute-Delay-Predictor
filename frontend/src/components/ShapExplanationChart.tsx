"use client";

import { useEffect, useState } from "react";
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
  category: "temporal" | "weather" | "event" | "historical";
}

interface ShapExplanationChartProps {
  factors: ShapFactor[];
}

function formatFactorValue(name: string, value: any): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  const nameLower = name.toLowerCase();
  const numVal = Number(value);

  if (isNaN(numVal)) {
    return String(value);
  }

  if (nameLower.includes("precipitation") || nameLower.includes("rain")) {
    return `${numVal.toFixed(1)} mm`;
  }
  if (nameLower.includes("temperature")) {
    return `${numVal.toFixed(1)}°C`;
  }
  if (nameLower.includes("visibility")) {
    return `${numVal.toFixed(1)} km`;
  }
  if (nameLower.includes("proximity") || nameLower.includes("distance")) {
    return `${numVal.toFixed(1)} km`;
  }
  if (
    nameLower.includes("recent traffic") ||
    nameLower.includes("lag") ||
    nameLower.includes("average delay") ||
    nameLower.includes("travel time")
  ) {
    return `${numVal.toFixed(1)} min`;
  }
  
  return Number.isInteger(numVal) ? numVal.toString() : numVal.toFixed(1);
}

const getCategoryColor = (category: string) => {
  switch (category) {
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

export default function ShapExplanationChart({ factors }: ShapExplanationChartProps) {
  const [isAnimationActive, setIsAnimationActive] = useState(true);

  // Check prefers-reduced-motion and adjust animations
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsAnimationActive(!mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setIsAnimationActive(!e.matches);
    };
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Format factors data for Recharts
  const chartData = factors.map((f) => {
    const formattedVal = formatFactorValue(f.name, f.value);
    return {
      ...f,
      displayName: `${f.name}: ${formattedVal}`,
      shapValue: f.shap_value_min,
    };
  });

  // Calculate symmetric bounds for the X-axis
  const maxAbs = Math.max(...chartData.map((d) => Math.abs(d.shapValue)), 0.5);
  const xDomain = [-maxAbs * 1.25, maxAbs * 1.25];

  // Custom cell label renderer
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    const isPositive = value >= 0;
    const textAnchor = isPositive ? "start" : "end";
    const offset = isPositive ? 8 : -8;
    const labelX = isPositive ? x + width + offset : x + offset;
    const labelY = y + height / 2 + 4; // Center vertically (+4px for standard font baseline)

    return (
      <text
        x={labelX}
        y={labelY}
        textAnchor={textAnchor}
        fill="var(--color-ink)"
        className="font-mono font-semibold text-[11px]"
      >
        {isPositive ? "+" : ""}{value.toFixed(2)} min
      </text>
    );
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Category Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pb-4 border-b border-border text-xs font-medium text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-factor-peak border border-factor-peak/20" />
          <span>Temporal / Hour</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-factor-rain border border-factor-rain/20" />
          <span>Weather Conditions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-factor-event border border-factor-event/20" />
          <span>Nearby Events</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-factor-historical border border-factor-historical/20" />
          <span>Historical Average / Lag</span>
        </div>
      </div>

      {/* Chart container */}
      <div className="h-[480px] w-full" style={{ outline: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            barCategoryGap={6}
          >
            <XAxis
              type="number"
              domain={xDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-text-secondary)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(value) => `${value > 0 ? "+" : ""}${value}m`}
            />
            <YAxis
              type="category"
              dataKey="displayName"
              width={180}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-ink)", fontSize: 11, fontWeight: 500 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(28, 34, 51, 0.02)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as typeof chartData[0];
                  const sign = data.shapValue >= 0 ? "+" : "";
                  return (
                    <div className="bg-bg-surface border border-border px-3 py-2.5 rounded-xl shadow-lg flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-ink">{data.name}</span>
                      <div className="flex items-center justify-between gap-4 mt-1">
                        <span className="text-text-secondary">Current value:</span>
                        <span className="font-medium text-ink bg-bg-page px-1.5 py-0.5 rounded border border-border">
                          {formatFactorValue(data.name, data.value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 mt-1 border-t border-border/60 pt-1">
                        <span className="text-text-secondary font-medium">Attribution:</span>
                        <span
                          className="font-mono font-bold px-1.5 py-0.5 rounded text-xs"
                          style={{
                            color: getCategoryColor(data.category),
                            backgroundColor: getCategoryBgColor(data.category),
                          }}
                        >
                          {sign}{data.shapValue.toFixed(2)} min
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine x={0} stroke="var(--color-border)" strokeWidth={1.5} />
            <Bar dataKey="shapValue" isAnimationActive={isAnimationActive}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getCategoryColor(entry.category)} />
              ))}
              <LabelList dataKey="shapValue" content={renderCustomLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-[10px] text-text-muted italic">
        * Bars extending right (+) push delay up. Bars extending left (-) pull delay down.
      </div>
    </div>
  );
}
