import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geocode?q=<query>
 *
 * Server-side proxy for TomTom Fuzzy Search API.
 * Keeps TOMTOM_API_KEY private (no NEXT_PUBLIC_ prefix).
 * Results are biased toward Bengaluru (lat 12.97, lon 77.59).
 */

const TOMTOM_SEARCH_URL = "https://api.tomtom.com/search/2/search";

// Bengaluru bounding box (approx): SW corner → NE corner
const BENGALURU_BIAS = {
  lat: 12.9716,
  lon: 77.5946,
  // topLeft / btmRight bounding box covering greater Bengaluru
  topLeftLat: 13.15,
  topLeftLon: 77.4,
  btmRightLat: 12.75,
  btmRightLon: 77.8,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  // Validate input
  if (!query || query.length < 2) {
    return NextResponse.json(
      { results: [], error: "Query must be at least 2 characters." },
      { status: 400 }
    );
  }

  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    console.error("[geocode] TOMTOM_API_KEY is not set in environment.");
    return NextResponse.json(
      { results: [], error: "Geocoding service is not configured." },
      { status: 500 }
    );
  }

  // Build TomTom Fuzzy Search URL
  const params = new URLSearchParams({
    key: apiKey,
    language: "en-US",
    limit: "6",
    countrySet: "IN",
    lat: String(BENGALURU_BIAS.lat),
    lon: String(BENGALURU_BIAS.lon),
    radius: "50000", // 50 km radius bias
    topLeft: `${BENGALURU_BIAS.topLeftLat},${BENGALURU_BIAS.topLeftLon}`,
    btmRight: `${BENGALURU_BIAS.btmRightLat},${BENGALURU_BIAS.btmRightLon}`,
    typeahead: "true",
  });

  const url = `${TOMTOM_SEARCH_URL}/${encodeURIComponent(query)}.json?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      // Revalidate/cache for 60s to reduce API calls for identical queries
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[geocode] TomTom API error ${response.status}: ${errorText}`);
      return NextResponse.json(
        { results: [], error: "Geocoding service returned an error." },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Transform TomTom results into a clean, minimal shape
    interface TomTomResult {
      id: string;
      type: string;
      poi?: { name: string };
      address: {
        freeformAddress?: string;
        municipality?: string;
        countrySubdivision?: string;
        localName?: string;
      };
      position: { lat: number; lon: number };
    }

    const results = (data.results || []).map((r: TomTomResult) => {
      const addr = r.address || {};
      const pos = r.position || {};

      // Build a readable name: prefer POI name, then freeformAddress
      const primaryName =
        r.poi?.name || addr.freeformAddress || "Unknown location";

      // Build locality line: municipality / subdivision
      const locality = [addr.municipality, addr.countrySubdivision]
        .filter(Boolean)
        .join(", ");

      return {
        id: r.id,
        name: primaryName,
        locality: locality || addr.localName || "",
        fullAddress: addr.freeformAddress || primaryName,
        lat: pos.lat,
        lng: pos.lon,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[geocode] Unexpected error:", err);
    return NextResponse.json(
      { results: [], error: "Failed to reach geocoding service." },
      { status: 500 }
    );
  }
}
