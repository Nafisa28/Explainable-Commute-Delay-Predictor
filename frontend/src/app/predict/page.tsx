"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { GeocodedLocation } from "@/components/AddressAutocomplete";
import DepartureTimePicker from "@/components/DepartureTimePicker";
import { StaggerContainer, ScrollReveal } from "@/components/ScrollReveal";
import TiltContainer from "@/components/TiltContainer";
import MagneticButton from "@/components/MagneticButton";

export default function PredictPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState<GeocodedLocation | null>(null);
  const [destination, setDestination] = useState<GeocodedLocation | null>(null);
  const [departureTime, setDepartureTime] = useState<string>(() =>
    new Date().toISOString()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) return;

    // Build the query params. Note: backend predictions are not fully wired up yet,
    // but we can pass the name and coordinates cleanly to the results page.
    const queryParams = new URLSearchParams({
      origin_name: origin.name,
      origin_lat: String(origin.lat),
      origin_lng: String(origin.lng),
      dest_name: destination.name,
      dest_lat: String(destination.lat),
      dest_lng: String(destination.lng),
      departure_time: departureTime,
    });

    router.push(`/predict/results?${queryParams.toString()}`);
  };

  const isFormValid = origin !== null && destination !== null;

  return (
    <div className="page-container py-8">
      {/* Header */}
      <div className="mb-8">
        <span className="badge-pill mb-3">Custom Route</span>
        <h1 className="section-heading mb-2">Predict Commute Delay</h1>
        <p className="text-text-secondary text-sm sm:text-base max-w-2xl">
          Enter any origin and destination address in Bengaluru to fetch live
          traffic congestion and estimate your expected delay.
        </p>
      </div>

      <StaggerContainer className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Route selection via geocoding (7 cols on lg) */}
          <div className="lg:col-span-7">
            <ScrollReveal>
            <div className="card flex flex-col gap-6">
              <h2 className="text-base font-semibold text-ink">Route Details</h2>
              
              <AddressAutocomplete
                label="Origin"
                placeholder="Enter starting point (e.g., Whitefield, Koramangala)..."
                value={origin}
                onSelect={(loc) => setOrigin(loc)}
                onClear={() => setOrigin(null)}
                inputId="origin-address"
                accentClass="text-accent-route"
              />

              <div className="flex justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    const temp = origin;
                    setOrigin(destination);
                    setDestination(temp);
                  }}
                  className="touch-target w-11 h-11 rounded-full border border-border bg-bg-surface text-text-muted hover:text-ink hover:border-accent-route/50 transition-all flex items-center justify-center shadow-sm"
                  title="Swap Origin and Destination"
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
                    <polyline points="17 1 21 5 17 9" />
                    <line x1="3" y1="5" x2="21" y2="5" />
                    <polyline points="7 23 3 19 7 15" />
                    <line x1="21" y1="19" x2="3" y2="19" />
                  </svg>
                </button>
              </div>

              <AddressAutocomplete
                label="Destination"
                placeholder="Enter destination (e.g., MG Road, Electronic City)..."
                value={destination}
                onSelect={(loc) => setDestination(loc)}
                onClear={() => setDestination(null)}
                inputId="destination-address"
                accentClass="text-accent-route"
              />
            </div>
            </ScrollReveal>
          </div>

          {/* Right Column: Departure Time & Prediction Summary Review (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <ScrollReveal>
            <TiltContainer>
            {/* Input & Action Card */}
            <form onSubmit={handleSubmit} className="card glow-metric flex flex-col gap-5">
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
                {origin || destination ? (
                  <div className="flex flex-col gap-2 text-sm">
                    {origin && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wide w-10 mt-0.5">
                          From:
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-ink truncate">
                            {origin.name}
                          </span>
                          <span className="text-[10px] text-text-secondary truncate">
                            {origin.locality || origin.fullAddress}
                          </span>
                        </div>
                      </div>
                    )}
                    {destination && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wide w-10 mt-0.5">
                          To:
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-ink truncate">
                            {destination.name}
                          </span>
                          <span className="text-[10px] text-text-secondary truncate">
                            {destination.locality || destination.fullAddress}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-text-muted italic">
                    No location selected yet. Enter details on the left.
                  </span>
                )}
              </div>

              {/* Submit CTA */}
              <MagneticButton
                type="submit"
                disabled={!isFormValid}
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
              </MagneticButton>
            </form>
            </TiltContainer>
            </ScrollReveal>
          </div>
      </StaggerContainer>
    </div>
  );
}

