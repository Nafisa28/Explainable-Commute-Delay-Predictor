"use client";

import { useState, useId } from "react";

interface DepartureTimePickerProps {
  value: string; // ISO string
  onChange: (isoString: string) => void;
}

type TimePreset = "now" | "15m" | "30m" | "1h" | "2h" | "custom";

export default function DepartureTimePicker({
  value,
  onChange,
}: DepartureTimePickerProps) {
  const [preset, setPreset] = useState<TimePreset>("now");
  const timeInputId = useId();

  // Helper to calculate offset ISO date
  const handlePresetSelect = (p: TimePreset) => {
    setPreset(p);
    const now = new Date();

    if (p === "now") {
      onChange(now.toISOString());
    } else if (p === "15m") {
      const target = new Date(now.getTime() + 15 * 60 * 1000);
      onChange(target.toISOString());
    } else if (p === "30m") {
      const target = new Date(now.getTime() + 30 * 60 * 1000);
      onChange(target.toISOString());
    } else if (p === "1h") {
      const target = new Date(now.getTime() + 60 * 60 * 1000);
      onChange(target.toISOString());
    } else if (p === "2h") {
      const target = new Date(now.getTime() + 120 * 60 * 1000);
      onChange(target.toISOString());
    }
  };

  // Format date for datetime-local input (YYYY-MM-DDTHH:MM in local time)
  const formatForDateTimeLocal = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      const offsetMs = d.getTimezoneOffset() * 60 * 1000;
      const localTime = new Date(d.getTime() - offsetMs);
      return localTime.toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  const handleCustomDateChange = (val: string) => {
    if (!val) return;
    try {
      const localDate = new Date(val);
      if (!isNaN(localDate.getTime())) {
        onChange(localDate.toISOString());
      }
    } catch (e) {
      console.error("Invalid custom date:", e);
    }
  };

  // Format display string
  const formatDisplayTime = (iso: string) => {
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return "Invalid date";
      
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minutesStr = minutes < 10 ? "0" + minutes : minutes;
      
      return `${hours}:${minutesStr} ${ampm}`;
    } catch {
      return "Now";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor={timeInputId}
          className="text-sm font-semibold text-ink flex items-center gap-1.5"
        >
          <span>Departure Time</span>
        </label>
        <span className="text-xs font-mono text-text-secondary">
          {formatDisplayTime(value)}
        </span>
      </div>

      {/* Preset Pill Buttons */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Departure time presets">
        <button
          type="button"
          onClick={() => handlePresetSelect("now")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            preset === "now"
              ? "bg-accent-route text-white border-accent-route shadow-xs"
              : "bg-bg-surface text-text-secondary border-border hover:border-accent-route/40 hover:text-ink"
          }`}
        >
          Now
        </button>
        <button
          type="button"
          onClick={() => handlePresetSelect("15m")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            preset === "15m"
              ? "bg-accent-route text-white border-accent-route shadow-xs"
              : "bg-bg-surface text-text-secondary border-border hover:border-accent-route/40 hover:text-ink"
          }`}
        >
          +15m
        </button>
        <button
          type="button"
          onClick={() => handlePresetSelect("30m")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            preset === "30m"
              ? "bg-accent-route text-white border-accent-route shadow-xs"
              : "bg-bg-surface text-text-secondary border-border hover:border-accent-route/40 hover:text-ink"
          }`}
        >
          +30m
        </button>
        <button
          type="button"
          onClick={() => handlePresetSelect("1h")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            preset === "1h"
              ? "bg-accent-route text-white border-accent-route shadow-xs"
              : "bg-bg-surface text-text-secondary border-border hover:border-accent-route/40 hover:text-ink"
          }`}
        >
          +1h
        </button>
        <button
          type="button"
          onClick={() => handlePresetSelect("2h")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            preset === "2h"
              ? "bg-accent-route text-white border-accent-route shadow-xs"
              : "bg-bg-surface text-text-secondary border-border hover:border-accent-route/40 hover:text-ink"
          }`}
        >
          +2h
        </button>
        <button
          type="button"
          onClick={() => setPreset("custom")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            preset === "custom"
              ? "bg-accent-route text-white border-accent-route shadow-xs"
              : "bg-bg-surface text-text-secondary border-border hover:border-accent-route/40 hover:text-ink"
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom DateTime Picker (Rendered if 'custom' is selected) */}
      {preset === "custom" && (
        <div className="mt-1">
          <input
            id={timeInputId}
            type="datetime-local"
            value={formatForDateTimeLocal(value)}
            onChange={(e) => handleCustomDateChange(e.target.value)}
            className="input-field text-sm font-mono"
            aria-label="Custom departure time"
          />
        </div>
      )}

      {/* ISO Value Preview info */}
      <div className="flex items-center justify-between text-[11px] text-text-muted mt-0.5">
        <span>ISO Payload:</span>
        <span className="font-mono truncate max-w-[220px]" title={value}>
          {value}
        </span>
      </div>
    </div>
  );
}
