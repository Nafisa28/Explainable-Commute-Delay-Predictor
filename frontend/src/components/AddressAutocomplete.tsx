"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface GeocodedLocation {
  id: string;
  name: string;
  locality: string;
  fullAddress: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  /** "Origin" or "Destination" */
  label: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Currently selected location (controlled) */
  value: GeocodedLocation | null;
  /** Callback when a suggestion is selected */
  onSelect: (location: GeocodedLocation) => void;
  /** Callback when selection is cleared */
  onClear: () => void;
  /** Unique id for the input */
  inputId: string;
  /** Accent color variant */
  accentClass?: string;
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function AddressAutocomplete({
  label,
  placeholder = "Search for an address…",
  value,
  onSelect,
  onClear,
  inputId,
  accentClass = "text-accent-route",
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch suggestions with debounce ───────────────────────────────── */

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setResults([]);
      } else if (data.results.length === 0) {
        setError(null);
        setResults([]);
      } else {
        setResults(data.results);
        setError(null);
      }
      setIsOpen(true);
    } catch {
      setError("Network error. Check your connection.");
      setResults([]);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);

    // If user is editing after a selection, clear the selection
    if (value) {
      onClear();
    }

    // Debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val.trim()), 300);
  };

  /* ── Selection ─────────────────────────────────────────────────────── */

  const handleSelect = (loc: GeocodedLocation) => {
    onSelect(loc);
    setQuery(loc.name);
    setIsOpen(false);
    setResults([]);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setError(null);
    setActiveIndex(-1);
    onClear();
    inputRef.current?.focus();
  };

  /* ── Keyboard navigation ───────────────────────────────────────────── */

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  /* ── Click-outside to close ────────────────────────────────────────── */

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ── Cleanup debounce on unmount ───────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* ── Sync display when value is set externally ─────────────────────── */
  useEffect(() => {
    if (value && query !== value.name) {
      setQuery(value.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /* ── Render ────────────────────────────────────────────────────────── */

  const showDropdown = isOpen && (results.length > 0 || error !== null || (query.length >= 3 && !loading && results.length === 0));

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {/* Label */}
      <label
        htmlFor={inputId}
        className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5"
      >
        <span>{label}</span>
        {value && (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold ${accentClass} bg-accent-route-dim px-1.5 py-0.5 rounded-full`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Set
          </span>
        )}
      </label>

      {/* Input with icons */}
      <div className="relative">
        {/* Search / Pin icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
          {value ? (
            /* Map pin when selected */
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={accentClass}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ) : (
            /* Search icon */
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 && !value) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`input-field pl-9 pr-9 ${
            value
              ? "border-accent-route/40 bg-accent-route-dim/10"
              : ""
          }`}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={`${inputId}-listbox`}
          aria-activedescendant={
            activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined
          }
        />

        {/* Right side: spinner or clear button */}
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
          {loading ? (
            <div className="w-4 h-4 border-2 border-border border-t-accent-route rounded-full animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-text-muted hover:text-ink text-sm transition-colors p-0.5"
              aria-label={`Clear ${label.toLowerCase()}`}
              tabIndex={-1}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-bg-surface border border-border rounded-xl shadow-lg overflow-hidden"
          style={{ maxHeight: "260px", overflowY: "auto" }}
          data-lenis-prevent
        >
          {/* Results */}
          {results.length > 0 &&
            results.map((loc, idx) => (
              <div
                key={loc.id}
                id={`${inputId}-option-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                onClick={() => handleSelect(loc)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex items-start gap-2.5 px-3.5 py-2.5 cursor-pointer transition-colors ${
                  idx === activeIndex
                    ? "bg-accent-route-dim/30"
                    : "hover:bg-bg-page"
                }`}
              >
                {/* Pin icon */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-muted shrink-0 mt-0.5"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-ink truncate">
                    {loc.name}
                  </span>
                  {loc.locality && (
                    <span className="text-xs text-text-secondary truncate">
                      {loc.locality}
                    </span>
                  )}
                </div>
              </div>
            ))}

          {/* No results */}
          {results.length === 0 && !error && query.length >= 3 && !loading && (
            <div className="px-4 py-5 text-center">
              <div className="text-lg mb-1">📍</div>
              <p className="text-sm font-medium text-ink">
                No locations found
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Try a more specific address or landmark name.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-4 text-center">
              <div className="text-lg mb-1">⚠️</div>
              <p className="text-xs text-text-secondary">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Selected location detail */}
      {value && (
        <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-0.5 pl-0.5">
          <span className="truncate">{value.fullAddress}</span>
          <span className="text-text-muted">
            ({value.lat.toFixed(4)}, {value.lng.toFixed(4)})
          </span>
        </div>
      )}
    </div>
  );
}
