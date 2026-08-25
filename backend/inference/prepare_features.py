import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone, date
from typing import Optional

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client

from backend.features.constants import BENGALURU_HOLIDAYS_2026
from backend.model.constants import FEATURE_COLUMNS, CATEGORICAL_FEATURES

# Load model bundle once at module level to extract exact categorical mapping
MODEL_PATH = os.path.join(PROJECT_ROOT, 'backend', 'model', 'artifacts', 'xgboost_delay_model.pkl')
MODEL_CATEGORIES = {}

if os.path.exists(MODEL_PATH):
    try:
        import joblib
        bundle = joblib.load(MODEL_PATH)
        booster = bundle['model'].get_booster()
        json_bytes = booster.save_raw(raw_format='json')
        model_json = json.loads(json_bytes.decode('utf-8'))
        cats_enc = model_json.get('learner', {}).get('gradient_booster', {}).get('model', {}).get('cats', {}).get('enc', [])
        feature_names = model_json.get('learner', {}).get('feature_names', [])
        for idx, enc in enumerate(cats_enc):
            offsets = enc.get('offsets', [])
            values = enc.get('values', [])
            if len(offsets) > 1 and idx < len(feature_names):
                feature_name = feature_names[idx]
                categories = []
                for i in range(len(offsets) - 1):
                    start = offsets[i]
                    end = offsets[i+1]
                    char_codes = values[start:end]
                    categories.append("".join(chr(c) for c in char_codes))
                MODEL_CATEGORIES[feature_name] = categories
    except Exception as e:
        print(f"Warning: Could not parse categories from model artifact: {e}")

def prepare_feature_row(
    route_id: str,
    departure_time: datetime,
    path_variant: Optional[str] = None,
    supabase_client: Optional[Client] = None
) -> pd.DataFrame:
    """
    Constructs a single-row feature vector matching the exact structure and
    data types of the trained model, querying Supabase for weather, event,
    and historical traffic lag features.

    Parameters:
    - route_id: UUID string of the route
    - departure_time: timezone-aware or naive datetime representing departure
    - path_variant: Optional string override for path variant. If not specified,
                    defaults to the label of the first path variant in routes table.
    - supabase_client: Optional authenticated Supabase Client. If not provided,
                       a new client is initialized using environment credentials.

    Returns:
    - pd.DataFrame with 1 row and exactly 15 columns in the order expected by the model.
    """
    # 1. Initialize Supabase Client if needed
    if supabase_client is None:
        load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
        load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in the environment.")
        supabase_client = create_client(supabase_url, supabase_key)

    # 2. Resolve path_variant
    if path_variant is None:
        route_res = supabase_client.table('routes').select('path_variants').eq('id', route_id).execute()
        if not route_res.data:
            raise ValueError(f"Route with ID {route_id} not found in database.")
        path_variants_list = route_res.data[0].get('path_variants')
        if not path_variants_list:
            raise ValueError(f"No path variants list found for Route ID {route_id}.")
        resolved_path_variant = path_variants_list[0].get('label')
    else:
        resolved_path_variant = path_variant

    # 3. Ensure departure_time is timezone-aware UTC
    if departure_time.tzinfo is None:
        dt_utc = departure_time.replace(tzinfo=timezone.utc)
    else:
        dt_utc = departure_time.astimezone(timezone.utc)

    # 4. Compute temporal features
    hour_fraction = dt_utc.hour + dt_utc.minute / 60.0 + dt_utc.second / 3600.0
    hour_sin = np.sin(2 * np.pi * hour_fraction / 24.0)
    hour_cos = np.cos(2 * np.pi * hour_fraction / 24.0)
    day_of_week = dt_utc.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    is_holiday = dt_utc.date() in BENGALURU_HOLIDAYS_2026

    # 5. Fetch nearest weather features
    w_before = (
        supabase_client.table('weather_logs')
        .select('*')
        .lte('timestamp', dt_utc.isoformat())
        .order('timestamp', desc=True)
        .limit(1)
        .execute()
    )
    w_after = (
        supabase_client.table('weather_logs')
        .select('*')
        .gte('timestamp', dt_utc.isoformat())
        .order('timestamp', desc=False)
        .limit(1)
        .execute()
    )

    selected_weather = None
    if w_before.data and w_after.data:
        t_before = pd.to_datetime(w_before.data[0]['timestamp'])
        t_after = pd.to_datetime(w_after.data[0]['timestamp'])
        diff_before = abs((dt_utc - t_before).total_seconds())
        diff_after = abs((t_after - dt_utc).total_seconds())
        if diff_before <= diff_after:
            selected_weather = w_before.data[0]
        else:
            selected_weather = w_after.data[0]
    elif w_before.data:
        selected_weather = w_before.data[0]
    elif w_after.data:
        selected_weather = w_after.data[0]

    if selected_weather:
        rainfall_mm = selected_weather.get('rainfall_mm')
        temperature = selected_weather.get('temperature')
        condition = selected_weather.get('condition')
        visibility = selected_weather.get('visibility')
    else:
        rainfall_mm = None
        temperature = None
        condition = None
        visibility = None

    # Weather Imputation
    if rainfall_mm is None:
        rainfall_mm = 0.0
    if temperature is None:
        temperature = 25.0
    if visibility is None:
        visibility = 10000.0

    # Note: condition is left as NaN/None (not "Unknown" or any other placeholder)
    # because XGBoost's categorical handling expects that, and training never imputed it either.
    if condition is not None:
        condition = str(condition)

    # 6. Fetch events features
    events_res = (
        supabase_client.table('events')
        .select('*')
        .eq('date', dt_utc.date().isoformat())
        .execute()
    )

    matching_events = []
    route_id_lower = route_id.lower()
    for event in events_res.data:
        affected_routes = event.get('route_ids_affected') or []
        if isinstance(affected_routes, str):
            try:
                affected_routes = json.loads(affected_routes)
            except:
                pass
        if any(str(rid).lower() == route_id_lower for rid in affected_routes):
            matching_events.append(event)

    if matching_events:
        matching_events.sort(key=lambda x: x.get('distance_to_route_km', 999.0))
        closest_event = matching_events[0]
        has_event = 1 if closest_event.get('event_type') is not None else 0
        distance_to_event_km = closest_event.get('distance_to_route_km')
    else:
        has_event = 0
        distance_to_event_km = None

    # Event Imputation
    if distance_to_event_km is None:
        distance_to_event_km = 999.0

    # 7. Fetch lag features (traffic history)
    traffic_res = (
        supabase_client.table('traffic_logs')
        .select('travel_time_min, timestamp')
        .eq('route_id', route_id)
        .eq('path_variant', resolved_path_variant)
        .lt('timestamp', dt_utc.isoformat())
        .order('timestamp', desc=True)
        .execute()
    )

    last_observed_travel_time = None
    if traffic_res.data:
        last_observed_travel_time = traffic_res.data[0].get('travel_time_min')

    # Note: this uses the current dynamic mean of traffic_logs as an approximation of the original
    # frozen training-split mean (which isn't persisted in the model artifact), and these two values
    # will drift apart over time as more data is collected. This is a known, accepted limitation.
    if last_observed_travel_time is None:
        mean_res = supabase_client.table('traffic_logs').select('travel_time_min').execute()
        if mean_res.data:
            times = [row['travel_time_min'] for row in mean_res.data if row.get('travel_time_min') is not None]
            last_observed_travel_time = sum(times) / len(times) if times else 30.0
        else:
            last_observed_travel_time = 30.0

    # Historical average delay for the same route + variant + hour of day + day of week
    matching_lags = []
    for row in traffic_res.data:
        ts = pd.to_datetime(row['timestamp'])
        ts_utc = ts.tz_convert('UTC') if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        if ts_utc.hour == dt_utc.hour and ts_utc.weekday() == dt_utc.weekday():
            matching_lags.append(row['travel_time_min'])

    if matching_lags:
        historical_avg_delay = sum(matching_lags) / len(matching_lags)
    else:
        historical_avg_delay = 0.0

    # 8. Create final DataFrame row
    row_data = {
        "route_id": route_id,
        "path_variant": resolved_path_variant,
        "hour_sin": float(hour_sin),
        "hour_cos": float(hour_cos),
        "day_of_week": int(day_of_week),
        "is_weekend": int(is_weekend),
        "is_holiday": bool(is_holiday),
        "rainfall_mm": float(rainfall_mm),
        "temperature": float(temperature),
        "condition": condition,  # Remains string/None, cast to category next
        "visibility": float(visibility),
        "has_event": int(has_event),
        "distance_to_event_km": float(distance_to_event_km),
        "last_observed_travel_time": float(last_observed_travel_time),
        "historical_avg_delay": float(historical_avg_delay)
    }

    # Order columns exactly matching FEATURE_COLUMNS
    df_row = pd.DataFrame([row_data], columns=FEATURE_COLUMNS)

    # Cast to pandas category dtype for model compatibility using the exact training categories
    for col in CATEGORICAL_FEATURES:
        if col in MODEL_CATEGORIES:
            df_row[col] = pd.Categorical(df_row[col], categories=MODEL_CATEGORIES[col])
        else:
            df_row[col] = df_row[col].astype('category')

    return df_row
