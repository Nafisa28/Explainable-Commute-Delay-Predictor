/**
 * ============================================================================
 * Slice 1 Mock API — Commute Delay Predictor
 * ============================================================================
 *
 * Current PredictionResponse Contract (Freeze for Slice 1 / Slice 2 frontend):
 * {
 *   route_id: string;            // e.g. "route-1"
 *   route_name: string;          // e.g. "Silk Board ➔ Whitefield IT Corridor"
 *   path_variant: string;        // e.g. "via Outer Ring Road (ORR)"
 *   departure_time: string;      // ISO 8601 string (e.g. "2026-08-24T10:30:00.000Z")
 *   predicted_delay_min: number; // e.g. 26
 *   baseline_delay_min: number;  // historical benchmark e.g. 10
 *   confidence: "low" | "medium" | "high";
 * }
 *
 * Migration Note for Slice 4 (Backend Integration):
 * 1. Replace `getRoutes()` with `GET /routes` (or Supabase `routes` table query).
 * 2. Replace `getPrediction(routeId, departureTime)` with `POST /predict`.
 * 3. Slice 2 will introduce an `explanations` / `shap_values` factor breakdown
 *    property on the response payload (Rain, Peak hour, Events, Road type).
 * ============================================================================
 */

import { ConfidenceLevel, PredictionResponse, Route } from "@/types/prediction";

export const BENGALURU_ROUTES: Route[] = [
  {
    id: "route-1",
    name: "Silk Board ➔ Whitefield IT Corridor",
    origin: "Silk Board Junction",
    destination: "Whitefield (ITPL)",
    path_variants: [
      "via Outer Ring Road (ORR)",
      "via Varthur Road",
      "via HAL Old Airport Road",
    ],
  },
  {
    id: "route-2",
    name: "Koramangala ➔ Electronic City",
    origin: "Koramangala 5th Block",
    destination: "Electronic City Phase 1",
    path_variants: [
      "via Hosur Road Flyover",
      "via Bannerghatta Road & NICE Road",
    ],
  },
  {
    id: "route-3",
    name: "Hebbal ➔ MG Road Central",
    origin: "Hebbal Flyover",
    destination: "MG Road Metro Station",
    path_variants: [
      "via Bellary Road Expressway",
      "via Jayamahal Road & Cantonment",
    ],
  },
  {
    id: "route-4",
    name: "Indiranagar ➔ HSR Layout",
    origin: "Indiranagar 100ft Road",
    destination: "HSR Layout Sector 1",
    path_variants: [
      "via Agara Junction & ORR",
      "via Koramangala 80ft Road",
      "via Inner Ring Road",
    ],
  },
  {
    id: "route-5",
    name: "Marathahalli ➔ Embassy TechVillage",
    origin: "Marathahalli Bridge",
    destination: "Embassy TechVillage, Devarabeesanahalli",
    path_variants: [
      "via Kadubeesanahalli Underpass",
      "via Panathur Main Road Bypass",
    ],
  },
  {
    id: "route-6",
    name: "Banashankari ➔ Malleshwaram",
    origin: "Banashankari Bus Terminal",
    destination: "Malleshwaram 8th Main",
    path_variants: [
      "via Kanakapura Road & City Station",
      "via Chord Road & Rajajinagar",
    ],
  },
  {
    id: "route-7",
    name: "Yelahanka ➔ Bengaluru International Airport",
    origin: "Yelahanka New Town",
    destination: "Kempegowda International Airport (BLR)",
    path_variants: [
      "via NH 44 Airport Toll Road",
      "via Bagalur Main Road",
    ],
  },
  {
    id: "route-8",
    name: "JP Nagar ➔ Manyata Tech Park",
    origin: "JP Nagar 6th Phase",
    destination: "Manyata Tech Park, Nagavara",
    path_variants: [
      "via Outer Ring Road North Arc",
      "via Silk Board & ORR East Arc",
      "via Thanisandra Main Road",
    ],
  },
  {
    id: "route-9",
    name: "Whitefield ➔ Indiranagar Hub",
    origin: "Hope Farm Junction, Whitefield",
    destination: "Indiranagar Metro Station",
    path_variants: [
      "via Hoodi & KR Puram Flyover",
      "via Old Airport Road & Marathahalli",
    ],
  },
];

/**
 * Simulates a network call to fetch available fixed routes in Bengaluru.
 * Resolves after a short simulated network latency.
 */
export async function getRoutes(): Promise<Route[]> {
  const latencyMs = Math.floor(Math.random() * 300) + 600; // 600-900ms
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(BENGALURU_ROUTES);
    }, latencyMs);
  });
}

/**
 * Simulates a network call to get delay prediction for a given route and departure time.
 * Matches backend contract shape with realistic route- & time-varying predictions.
 * Randomly fails ~15% of the time to exercise error handling.
 */
export async function getPrediction(
  routeId: string,
  departureTime: string
): Promise<PredictionResponse> {
  const latencyMs = Math.floor(Math.random() * 300) + 600; // 600-900ms

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 15% random failure rate to test error handling & retry UI
      if (Math.random() < 0.15) {
        reject(
          new Error(
            "Live traffic ingestion pipeline timed out for this corridor. Please try again."
          )
        );
        return;
      }

      const routeIndex = Math.max(
        0,
        BENGALURU_ROUTES.findIndex((r) => r.id === routeId)
      );
      const route = BENGALURU_ROUTES[routeIndex] || BENGALURU_ROUTES[0];
      const parsedDate = departureTime ? new Date(departureTime) : new Date();
      const departureIso = isNaN(parsedDate.getTime())
        ? new Date().toISOString()
        : parsedDate.toISOString();
      const departureDate = new Date(departureIso);
      const hour = departureDate.getHours();

      // Hours ahead from now
      const now = new Date();
      const diffHours = (departureDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // 1. Realistic Baseline Historical Delay (6 - 14 mins)
      const baselineDelay = 6 + ((routeIndex * 3 + 2) % 9);

      // 2. Time-of-day Traffic Congestion Curve
      let timeAddedDelay = 3;
      if (hour >= 8 && hour <= 10) {
        // Morning rush
        timeAddedDelay = 16 + ((routeIndex * 4) % 12);
      } else if (hour >= 17 && hour <= 20) {
        // Evening rush
        timeAddedDelay = 18 + ((routeIndex * 5) % 14);
      } else if (hour >= 11 && hour <= 16) {
        // Midday moderate
        timeAddedDelay = 7 + ((routeIndex * 2) % 6);
      } else if (hour >= 21 || hour < 6) {
        // Night / Early morning low
        timeAddedDelay = 1 + (routeIndex % 3);
      } else {
        // Shoulder period (6 - 8 AM)
        timeAddedDelay = 8 + (routeIndex % 5);
      }

      const predictedDelay = baselineDelay + timeAddedDelay;

      // 3. Dynamic Confidence Calculation:
      // - Far-future departure (> 2.5 hours ahead) or late-night window -> Low
      // - 2 path variants or moderate offset (> 1 hour ahead) -> Medium
      // - Standard daytime near-term departure with 3 path variants -> High
      let confidence: ConfidenceLevel = "high";
      if (diffHours > 2.5 || hour >= 23 || hour < 5) {
        confidence = "low";
      } else if (diffHours > 1 || route.path_variants.length <= 2 || predictedDelay > 30) {
        confidence = "medium";
      }

      const mockResponse: PredictionResponse = {
        route_id: route.id,
        route_name: route.name,
        path_variant: route.path_variants[0],
        departure_time: departureIso,
        predicted_delay_min: predictedDelay,
        baseline_delay_min: baselineDelay,
        confidence,
      };

      resolve(mockResponse);
    }, latencyMs);
  });
}
