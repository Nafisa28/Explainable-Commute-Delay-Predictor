"use client";

import { useState, useEffect } from "react";
import { Route } from "@/types/prediction";
import { getRoutes } from "@/lib/mockApi";

interface RoutePickerProps {
  selectedRoute: Route | null;
  onSelectRoute: (route: Route) => void;
}

export default function RoutePicker({
  selectedRoute,
  onSelectRoute,
}: RoutePickerProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function fetchRoutes() {
      try {
        setLoading(true);
        const data = await getRoutes();
        if (isMounted) {
          setRoutes(data);
        }
      } catch (err) {
        console.error("Failed to load routes:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchRoutes();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRoutes = routes.filter((route) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      route.name.toLowerCase().includes(q) ||
      route.origin.toLowerCase().includes(q) ||
      route.destination.toLowerCase().includes(q) ||
      route.path_variants.some((pv) => pv.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor="route-search"
          className="text-sm font-semibold text-ink flex items-center gap-1.5"
        >
          <span>Select Commute Route</span>
          {routes.length > 0 && !loading && (
            <span className="text-xs font-normal text-text-muted">
              ({routes.length} corridors)
            </span>
          )}
        </label>
        {selectedRoute && (
          <span className="text-xs font-medium text-accent-route bg-accent-route-dim px-2 py-0.5 rounded-full">
            Route selected
          </span>
        )}
      </div>

      {/* Filter / Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
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
        </div>
        <input
          id="route-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by locality (e.g. Whitefield, Koramangala, ORR)..."
          className="input-field pl-9 pr-8"
          disabled={loading}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-ink text-sm transition-colors"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Route List / Skeleton / Empty state */}
      <div
        className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1 focus:outline-none"
        role="listbox"
        aria-label="Available routes"
      >
        {loading ? (
          /* Skeleton Loading Rows */
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="p-3.5 rounded-xl border border-border bg-bg-surface flex flex-col gap-2 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-border/60 rounded w-2/3" />
                  <div className="h-3 bg-border/40 rounded w-16" />
                </div>
                <div className="h-3 bg-border/40 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredRoutes.length === 0 ? (
          /* Empty Search State */
          <div className="p-8 text-center border border-dashed border-border rounded-xl bg-bg-surface/50">
            <div className="text-2xl mb-2">🔍</div>
            <p className="text-sm font-medium text-ink mb-1">
              No routes found matching &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-xs text-text-secondary mb-3">
              Try searching for Whitefield, Koramangala, Hebbal, Indiranagar, or Airport.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs font-semibold text-accent-route hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          /* Route Rows */
          filteredRoutes.map((route) => {
            const isSelected = selectedRoute?.id === route.id;
            return (
              <div
                key={route.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => onSelectRoute(route)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRoute(route);
                  }
                }}
                className={`group relative p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none ${
                  isSelected
                    ? "bg-accent-route-dim/20 border-accent-route shadow-sm ring-1 ring-accent-route/30"
                    : "bg-bg-surface border-border hover:border-accent-route/50 hover:bg-bg-surface/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="font-semibold text-sm text-ink flex items-center gap-2">
                    {/* Active Route Selection Indicator Dot */}
                    <span
                      className={`inline-block w-2 h-2 rounded-full transition-colors ${
                        isSelected
                          ? "bg-accent-route scale-110"
                          : "bg-border group-hover:bg-accent-route/40"
                      }`}
                    />
                    <span>{route.name}</span>
                  </div>

                  {isSelected && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-accent-route shrink-0">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Selected
                    </span>
                  )}
                </div>

                {/* Origin → Destination */}
                <div className="flex items-center gap-1.5 text-xs text-text-secondary pl-4">
                  <span className="truncate max-w-[140px] sm:max-w-[180px]">
                    {route.origin}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-text-muted"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                  <span className="truncate max-w-[140px] sm:max-w-[180px]">
                    {route.destination}
                  </span>
                </div>

                {/* Path variants count hint */}
                <div className="mt-2 pl-4 flex items-center gap-2 text-[11px] text-text-muted">
                  <span className="badge-pill py-0.5 px-2 text-[11px]">
                    {route.path_variants.length} path variants
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
