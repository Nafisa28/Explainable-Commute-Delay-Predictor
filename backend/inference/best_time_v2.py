"""
Best Departure Time Module (Model V2)

Evaluates candidate departure times across a 2-3 hour forward window for arbitrary
coordinate pairs in Bengaluru, and recommends the optimal departure time that minimizes
actual total travel time to destination.
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.explainability.shap_explainer_v2 import (
    prepare_feature_row_v2,
    get_explainer_v2,
)
from backend.inference.live_traffic_features import (
    get_live_traffic_features,
    TomTomAPIError,
    TomTomTimeoutError,
    TomTomRateLimitError,
    TomTomValidationError,
)


def find_best_departure_time_v2(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    current_departure_time: Optional[datetime] = None,
    origin_name: Optional[str] = None,
    dest_name: Optional[str] = None,
    window_hours: float = 2.5,
    step_minutes: int = 15,
    supabase_client: Optional[Client] = None,
) -> Dict[str, Any]:
    """
    Evaluates candidate departure times across a forward window (default 2.5 hours at 15-min steps)
    and identifies the departure time with the lowest estimated travel time to destination.

    Parameters:
    - origin_lat, origin_lng: Coordinates of commute origin
    - dest_lat, dest_lng: Coordinates of commute destination
    - current_departure_time: Datetime of initial departure request (defaults to now UTC)
    - origin_name: Optional display label for origin
    - dest_name: Optional display label for destination
    - window_hours: Forward scanning window duration in hours (default: 2.5)
    - step_minutes: Time resolution between candidate departures (default: 15)
    - supabase_client: Optional Supabase client instance

    Returns:
    - Dict conforming to:
      {
        "origin_name": str,
        "dest_name": str,
        "current_departure_time": str (ISO 8601),
        "current_live_travel_time_min": float,
        "recommended_departure_time": str (ISO 8601),
        "recommended_live_travel_time_min": float,
        "savings_min": float,
        "free_flow_travel_time_min": float,
        "distance_km": float,
        "timeline": list of candidate evaluations
      }
    """
    # 1. Validation & timezone normalization
    if not (-90 <= origin_lat <= 90) or not (-90 <= dest_lat <= 90):
        raise TomTomValidationError(f"Invalid latitudes: origin_lat={origin_lat}, dest_lat={dest_lat}")
    if not (-180 <= origin_lng <= 180) or not (-180 <= dest_lng <= 180):
        raise TomTomValidationError(f"Invalid longitudes: origin_lng={origin_lng}, dest_lng={dest_lng}")

    if current_departure_time is None:
        current_departure_time = datetime.now(timezone.utc)
    elif current_departure_time.tzinfo is None:
        current_departure_time = current_departure_time.replace(tzinfo=timezone.utc)
    else:
        current_departure_time = current_departure_time.astimezone(timezone.utc)

    # 2. Query live traffic features once for this coordinate corridor
    traffic = get_live_traffic_features(origin_lat, origin_lng, dest_lat, dest_lng)
    free_flow_time = float(traffic.get("free_flow_travel_time_min", 0.0))
    current_live_time = float(traffic.get("live_travel_time_min", free_flow_time))
    distance_km = float(traffic.get("distance_km", 0.0))

    # 3. Setup Supabase client if needed
    if supabase_client is None:
        load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
        load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
        if url and key:
            try:
                supabase_client = create_client(url, key)
            except Exception:
                supabase_client = None

    # 4. Load Model V2
    _, bundle = get_explainer_v2()
    model = bundle['model']

    # 5. Build and evaluate candidate departure times across the window
    total_steps = max(1, int((window_hours * 60) / step_minutes))
    candidate_timeline: List[Dict[str, Any]] = []

    for i in range(total_steps + 1):
        cand_time = current_departure_time + timedelta(minutes=i * step_minutes)

        # Prepare single feature row for candidate departure time reusing corridor traffic stats
        feature_row = prepare_feature_row_v2(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            departure_time=cand_time,
            supabase_client=supabase_client,
            traffic=traffic,
        )

        predicted_delay_min = float(model.predict(feature_row)[0])

        if i == 0:
            # At current requested departure time, use the live travel time
            est_travel_time = current_live_time
        else:
            # Future estimated travel time = free-flow baseline + predicted traffic delay
            est_travel_time = free_flow_time + max(0.0, predicted_delay_min)

        candidate_timeline.append({
            "step_offset_min": i * step_minutes,
            "departure_time": cand_time.isoformat(),
            "travel_time_min": round(est_travel_time, 1),
            "predicted_delay_min": round(predicted_delay_min, 1),
        })

    # 6. Identify the candidate with the lowest travel time
    best_candidate = min(candidate_timeline, key=lambda c: c["travel_time_min"])
    rec_time = best_candidate["departure_time"]
    rec_travel_time = best_candidate["travel_time_min"]

    # Calculate actual time saved
    savings_min = max(0.0, current_live_time - rec_travel_time)

    resolved_origin = origin_name or f"({origin_lat:.4f}, {origin_lng:.4f})"
    resolved_dest = dest_name or f"({dest_lat:.4f}, {dest_lng:.4f})"

    return {
        "origin_name": resolved_origin,
        "dest_name": resolved_dest,
        "current_departure_time": current_departure_time.isoformat(),
        "current_live_travel_time_min": round(current_live_time, 1),
        "recommended_departure_time": rec_time,
        "recommended_live_travel_time_min": round(rec_travel_time, 1),
        "savings_min": round(savings_min, 1),
        "free_flow_travel_time_min": round(free_flow_time, 1),
        "distance_km": round(distance_km, 1),
        "timeline": candidate_timeline,
    }
