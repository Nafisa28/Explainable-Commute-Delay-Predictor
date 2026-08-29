"""
Alternate Route Comparison Module (Model V2)

Queries TomTom Routing API for alternate route geometries/summaries between arbitrary
coordinates in Bengaluru, runs Model V2 delay predictions for each alternative,
and returns options sorted by live travel time (fastest total commute first).
"""

import os
import sys
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import numpy as np
import pandas as pd
import requests
import joblib
from dotenv import load_dotenv
from supabase import create_client, Client

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.features.constants import BENGALURU_HOLIDAYS_2026
from backend.explainability.shap_explainer_v2 import (
    FEATURE_COLUMNS_V2,
    CATEGORICAL_FEATURES_V2,
    _load_model_categories_v2,
    _model_categories_v2,
    _fetch_nearest_weather,
    get_explainer_v2
)
from backend.inference.live_traffic_features import (
    TomTomAPIError,
    TomTomTimeoutError,
    TomTomRateLimitError,
    TomTomValidationError
)


def _build_distinct_route_names(routes: List[dict]) -> List[str]:
    """
    Builds distinct, human-readable route descriptions for a list of TomTom alternatives.
    1. Distance-weights road segments (ignoring immediate departure & arrival steps).
    2. Identifies prominent arterial corridors per route.
    3. Disambiguates any colliding or duplicate base names using road hierarchy,
       elevated/flyover tags, or free-flow speed profiles.
    """
    if not routes:
        return []

    route_stats = []

    for i, r in enumerate(routes):
        summary = r.get("summary", {})
        guidance = r.get("guidance", {})
        instructions = guidance.get("instructions", [])
        total_len = summary.get("lengthInMeters", 0)
        free_sec = summary.get("noTrafficTravelTimeInSeconds", 1)
        free_speed_kmh = (total_len / 1000.0) / (free_sec / 3600.0) if free_sec > 0 else 0

        road_lengths = {}
        special_tags = []
        num_inst = len(instructions)

        for idx in range(num_inst):
            inst = instructions[idx]
            curr_offset = inst.get("routeOffsetInMeters", 0)
            next_offset = instructions[idx + 1].get("routeOffsetInMeters", total_len) if idx + 1 < num_inst else total_len
            step_len = max(0, next_offset - curr_offset)

            street = inst.get("street", "").strip()
            msg = inst.get("message", "")

            combined_text = f"{street} {msg}".lower()
            if "flyover" in combined_text or "e c flyover" in combined_text:
                if "Flyover" not in special_tags:
                    special_tags.append("Flyover")
            if "elevated" in combined_text or "expressway" in combined_text:
                if "Elevated" not in special_tags:
                    special_tags.append("Elevated")

            # Exclude immediate departure and arrival steps (if route has enough steps)
            if num_inst > 3 and (idx == 0 or idx == num_inst - 1):
                continue

            if street:
                road_lengths[street] = road_lengths.get(street, 0) + step_len

        # Sort roads by distance descending
        sorted_roads = sorted(road_lengths.items(), key=lambda x: x[1], reverse=True)

        # Major roads that account for significant portions of the commute (>= 1.2 km or >= 8% of route)
        major_roads = [rd for rd, l in sorted_roads if l >= max(1200, total_len * 0.08)]
        if not major_roads and sorted_roads:
            major_roads = [sorted_roads[0][0]]

        route_stats.append({
            "index": i + 1,
            "total_len": total_len,
            "free_speed_kmh": free_speed_kmh,
            "special_tags": special_tags,
            "sorted_roads": sorted_roads,
            "major_roads": major_roads,
            "primary": major_roads[0] if major_roads else f"Route {i+1}",
            "secondary": major_roads[1] if len(major_roads) > 1 else None,
        })

    # Step 1: Assign initial candidate names based on top 1-2 distance-weighted roads
    for rs in route_stats:
        if rs.get("secondary"):
            rs["name"] = f"via {rs['primary']} & {rs['secondary']}"
        else:
            rs["name"] = f"via {rs['primary']}"

    # Step 2: Disambiguate identical or similar names across options
    def norm_corridor(text):
        return re.sub(r'\b(main road|road|rd|outer ring road|orr|expressway|flyover)\b', '', text.lower()).strip()

    for i in range(len(route_stats)):
        for j in range(i + 1, len(route_stats)):
            r1 = route_stats[i]
            r2 = route_stats[j]

            p1 = norm_corridor(r1["primary"])
            p2 = norm_corridor(r2["primary"])
            s1 = norm_corridor(r1["secondary"] or "")
            s2 = norm_corridor(r2["secondary"] or "")

            # If both options have identical names or share the same primary & secondary corridor
            if r1["name"] == r2["name"] or (p1 and p2 and p1 == p2 and s1 == s2):
                if "Flyover" in r1["special_tags"] or "Elevated" in r1["special_tags"]:
                    r1["name"] = f"via {r1['primary']} (Elevated Flyover)"
                    r2["name"] = f"via {r2['primary']} (Surface Road)"
                elif "Flyover" in r2["special_tags"] or "Elevated" in r2["special_tags"]:
                    r2["name"] = f"via {r2['primary']} (Elevated Flyover)"
                    r1["name"] = f"via {r1['primary']} (Surface Road)"
                elif abs(r1["free_speed_kmh"] - r2["free_speed_kmh"]) >= 2.5:
                    if r1["free_speed_kmh"] > r2["free_speed_kmh"]:
                        r1["name"] = f"via {r1['primary']} (Main Express)"
                        r2["name"] = f"via {r2['primary']} (Surface Road)"
                    else:
                        r2["name"] = f"via {r2['primary']} (Main Express)"
                        r1["name"] = f"via {r1['primary']} (Surface Road)"
                else:
                    sec1 = next((rd for rd, _ in r1["sorted_roads"] if norm_corridor(rd) != p1), None)
                    sec2 = next((rd for rd, _ in r2["sorted_roads"] if norm_corridor(rd) != p2), None)
                    if sec1 and sec2 and sec1 != sec2:
                        r1["name"] = f"via {r1['primary']} & {sec1}"
                        r2["name"] = f"via {r2['primary']} & {sec2}"
                    else:
                        r1["name"] = f"{r1['name']} (Option {r1['index']})"
                        r2["name"] = f"{r2['name']} (Option {r2['index']})"

    # Final guarantee: ensure 100% uniqueness in the returned array
    seen_names = {}
    for rs in route_stats:
        curr = rs["name"]
        if curr in seen_names:
            seen_names[curr] += 1
            rs["name"] = f"{curr} (Alternative {seen_names[curr]})"
        else:
            seen_names[curr] = 1

    return [rs["name"] for rs in route_stats]


def compare_alternate_routes(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    departure_time: Optional[datetime] = None,
    max_alternatives: int = 2,
    supabase_client: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves alternate routes from TomTom Routing API, computes Model V2
    delay predictions for each, and returns sorted options.

    Parameters:
    - origin_lat, origin_lng: Origin coordinates
    - dest_lat, dest_lng: Destination coordinates
    - departure_time: Datetime object (defaults to now UTC)
    - max_alternatives: Number of alternatives to request (default: 2 -> up to 3 total routes)
    - supabase_client: Supabase client for weather lookup

    Returns:
    - List of dicts sorted by live_travel_time_min ascending (fastest total commute first):
      [
        {
          "route_index": int,
          "description": str,
          "predicted_delay_min": float,
          "congestion_ratio": float,
          "distance_km": float,
          "live_travel_time_min": float,
          "free_flow_travel_time_min": float,
          "is_best": bool
        }, ...
      ]
    """
    # 1. API key & coordinate validation
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
    api_key = os.environ.get("TOMTOM_API_KEY")
    if not api_key:
        raise TomTomAPIError("TOMTOM_API_KEY not found in environment variables.")

    if not (-90 <= origin_lat <= 90) or not (-90 <= dest_lat <= 90):
        raise TomTomValidationError(f"Invalid latitudes: origin_lat={origin_lat}, dest_lat={dest_lat}")
    if not (-180 <= origin_lng <= 180) or not (-180 <= dest_lng <= 180):
        raise TomTomValidationError(f"Invalid longitudes: origin_lng={origin_lng}, dest_lng={dest_lng}")

    if departure_time is None:
        departure_time = datetime.now(timezone.utc)
    elif departure_time.tzinfo is None:
        departure_time = departure_time.replace(tzinfo=timezone.utc)
    else:
        departure_time = departure_time.astimezone(timezone.utc)

    # 2. Call TomTom Routing API with maxAlternatives
    locations = f"{origin_lat},{origin_lng}:{dest_lat},{dest_lng}"
    url = f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json"
    params = {
        "key": api_key,
        "traffic": "true",
        "departAt": "now",
        "computeTravelTimeFor": "all",
        "maxAlternatives": max_alternatives,
        "instructionsType": "text"
    }

    try:
        response = requests.get(url, params=params, timeout=10.0)
    except requests.exceptions.Timeout as e:
        raise TomTomTimeoutError(f"TomTom API request timed out: {e}")
    except requests.exceptions.RequestException as e:
        raise TomTomAPIError(f"TomTom API request failed: {e}")

    if response.status_code != 200:
        if response.status_code == 400:
            raise TomTomValidationError(f"TomTom validation error (400): {response.text}")
        elif response.status_code in (403, 429):
            raise TomTomRateLimitError(f"TomTom rate limit or permission error ({response.status_code}): {response.text}")
        raise TomTomAPIError(f"TomTom API error ({response.status_code}): {response.text}")

    data = response.json()
    routes = data.get("routes", [])
    if not routes:
        raise TomTomAPIError("TomTom response contained no routes.")

    # Generate distinct, distance-weighted descriptions for all alternatives
    descriptions = _build_distinct_route_names(routes)

    # 3. Setup Supabase for Weather Lookup
    if supabase_client is None:
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if supabase_url and supabase_key:
            supabase_client = create_client(supabase_url, supabase_key)

    # 4. Extract shared temporal and weather features
    hour_fraction = departure_time.hour + departure_time.minute / 60.0 + departure_time.second / 3600.0
    hour_sin = float(np.sin(2 * np.pi * hour_fraction / 24.0))
    hour_cos = float(np.cos(2 * np.pi * hour_fraction / 24.0))
    day_of_week = int(departure_time.weekday())
    is_weekend = 1 if day_of_week >= 5 else 0
    is_holiday = departure_time.date() in BENGALURU_HOLIDAYS_2026

    weather = {"rainfall_mm": 0.0, "temperature": 25.0, "condition": "Clear", "visibility": 10000.0}
    if supabase_client:
        try:
            w_res = _fetch_nearest_weather(departure_time, supabase_client)
            if w_res.get("temperature") is not None:
                weather = {
                    "rainfall_mm": float(w_res["rainfall_mm"]) if w_res["rainfall_mm"] is not None else 0.0,
                    "temperature": float(w_res["temperature"]) if w_res["temperature"] is not None else 25.0,
                    "condition": str(w_res["condition"]) if w_res["condition"] is not None else "Clear",
                    "visibility": float(w_res["visibility"]) if w_res["visibility"] is not None else 10000.0,
                }
        except Exception:
            pass

    # 5. Load Model V2
    _, bundle = get_explainer_v2()
    model = bundle['model']

    # 6. Evaluate each route alternative
    route_options = []

    for i, r in enumerate(routes):
        summary = r.get("summary", {})
        live_time_sec = float(summary.get("travelTimeInSeconds", 0))
        free_time_sec = float(summary.get("noTrafficTravelTimeInSeconds", 0))
        length_meters = float(summary.get("lengthInMeters", 0))

        if free_time_sec <= 0:
            free_time_sec = max(live_time_sec, 1.0)

        congestion_ratio = live_time_sec / free_time_sec
        live_travel_time_min = live_time_sec / 60.0
        free_flow_travel_time_min = free_time_sec / 60.0
        distance_km = length_meters / 1000.0

        description = descriptions[i] if i < len(descriptions) else f"Route {i + 1}"

        # Build feature vector for this route alternative
        row_data = {
            "congestion_ratio": float(congestion_ratio),
            "hour_sin": hour_sin,
            "hour_cos": hour_cos,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "is_holiday": bool(is_holiday),
            "rainfall_mm": weather["rainfall_mm"],
            "temperature": weather["temperature"],
            "condition": weather["condition"],
            "visibility": weather["visibility"],
            "has_event": 0,
            "distance_to_event_km": 999.0,
        }

        df_row = pd.DataFrame([row_data], columns=FEATURE_COLUMNS_V2)
        for col in CATEGORICAL_FEATURES_V2:
            if col in _model_categories_v2:
                df_row[col] = pd.Categorical(df_row[col], categories=_model_categories_v2[col])
            else:
                df_row[col] = df_row[col].astype('category')

        # Model V2 prediction
        predicted_delay_min = float(model.predict(df_row)[0])

        route_options.append({
            "route_index": i + 1,
            "description": description,
            "predicted_delay_min": round(predicted_delay_min, 1),
            "congestion_ratio": round(congestion_ratio, 2),
            "distance_km": round(distance_km, 1),
            "live_travel_time_min": round(live_travel_time_min, 1),
            "free_flow_travel_time_min": round(free_flow_travel_time_min, 1),
            "is_best": False
        })

    # 7. Sort by live_travel_time_min ascending (lowest actual travel time to destination is best)
    route_options.sort(key=lambda opt: opt["live_travel_time_min"])

    # Mark the best option
    if route_options:
        route_options[0]["is_best"] = True

    return route_options
