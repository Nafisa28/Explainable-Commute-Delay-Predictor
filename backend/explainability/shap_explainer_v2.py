"""
SHAP Explanation Module V2 — Route-Agnostic Commute Delay Predictor

This module provides explain_prediction_v2() which works with Model V2's
generalizable feature set (congestion_ratio, temporal, weather) and accepts
raw coordinates instead of pre-seeded route IDs.

Expected JSON output contract:
{
  "route_name": str,
  "predicted_delay_min": float,
  "base_value_min": float,
  "factors": [
    {
      "name": str,
      "value": <int|float|str|bool|null>,
      "shap_value_min": float,
      "category": "temporal" | "weather" | "event" | "live_traffic"
    }
  ]
}

Factors are sorted by absolute SHAP attribution descending.
"""

import os
import sys
import json
import joblib
import shap
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Optional

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client

from backend.features.constants import BENGALURU_HOLIDAYS_2026
from backend.inference.live_traffic_features import get_live_traffic_features

# ── V2 Feature Definitions ──────────────────────────────────────────────────

FEATURE_COLUMNS_V2 = [
    "congestion_ratio",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    "is_holiday",
    "rainfall_mm",
    "temperature",
    "condition",
    "visibility",
    "has_event",
    "distance_to_event_km"
]

CATEGORICAL_FEATURES_V2 = ["condition"]

FEATURE_MAPPING_V2 = {
    "congestion_ratio":    {"name": "Live congestion ratio",  "category": "live_traffic"},
    "day_of_week":         {"name": "Day of week",            "category": "temporal"},
    "is_weekend":          {"name": "Weekend indicator",      "category": "temporal"},
    "is_holiday":          {"name": "Holiday indicator",      "category": "temporal"},
    "rainfall_mm":         {"name": "Precipitation",          "category": "weather"},
    "temperature":         {"name": "Temperature",            "category": "weather"},
    "condition":           {"name": "Weather condition",      "category": "weather"},
    "visibility":          {"name": "Visibility",             "category": "weather"},
    "has_event":           {"name": "Nearby public event",    "category": "event"},
    "distance_to_event_km":{"name": "Event proximity",        "category": "event"},
}

# ── Module-level caching ────────────────────────────────────────────────────

_model_bundle_v2 = None
_explainer_v2 = None
_model_categories_v2 = {}


def _load_model_categories_v2():
    """Parse exact categorical encoding from the V2 model artifact."""
    global _model_categories_v2
    model_path = os.path.join(PROJECT_ROOT, 'backend', 'model', 'artifacts', 'xgboost_delay_model_v2.pkl')
    if not os.path.exists(model_path):
        return
    try:
        bundle = joblib.load(model_path)
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
                    end = offsets[i + 1]
                    char_codes = values[start:end]
                    categories.append("".join(chr(c) for c in char_codes))
                _model_categories_v2[feature_name] = categories
    except Exception as e:
        print(f"Warning: Could not parse categories from V2 model artifact: {e}")


# Load categories eagerly at import time
_load_model_categories_v2()


def get_explainer_v2():
    """
    Loads the V2 model bundle and initialises a TreeExplainer.
    Caches the results to avoid reloading on subsequent calls.
    """
    global _model_bundle_v2, _explainer_v2
    if _explainer_v2 is not None:
        return _explainer_v2, _model_bundle_v2

    model_path = os.path.join(PROJECT_ROOT, 'backend', 'model', 'artifacts', 'xgboost_delay_model_v2.pkl')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"V2 model artifact not found at {model_path}.")

    _model_bundle_v2 = joblib.load(model_path)
    model = _model_bundle_v2['model']
    _explainer_v2 = shap.TreeExplainer(model)
    return _explainer_v2, _model_bundle_v2


# ── Feature-row preparation ─────────────────────────────────────────────────

def _fetch_nearest_weather(dt_utc: datetime, supabase_client: Client) -> dict:
    """Fetch the nearest weather observation from Supabase."""
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

    selected = None
    if w_before.data and w_after.data:
        t_before = pd.to_datetime(w_before.data[0]['timestamp'])
        t_after = pd.to_datetime(w_after.data[0]['timestamp'])
        diff_before = abs((dt_utc - t_before).total_seconds())
        diff_after = abs((t_after - dt_utc).total_seconds())
        selected = w_before.data[0] if diff_before <= diff_after else w_after.data[0]
    elif w_before.data:
        selected = w_before.data[0]
    elif w_after.data:
        selected = w_after.data[0]

    if selected:
        return {
            "rainfall_mm": selected.get('rainfall_mm'),
            "temperature": selected.get('temperature'),
            "condition": selected.get('condition'),
            "visibility": selected.get('visibility'),
        }
    return {"rainfall_mm": None, "temperature": None, "condition": None, "visibility": None}


def prepare_feature_row_v2(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    departure_time: datetime,
    supabase_client: Optional[Client] = None,
) -> pd.DataFrame:
    """
    Constructs a single-row feature vector matching Model V2's schema.

    Parameters
    ----------
    origin_lat, origin_lng : float
        Origin coordinates.
    dest_lat, dest_lng : float
        Destination coordinates.
    departure_time : datetime
        Departure timestamp.
    supabase_client : Client, optional
        Supabase client (for weather/event lookup). Created from env if None.

    Returns
    -------
    pd.DataFrame with 1 row and exactly 12 columns in FEATURE_COLUMNS_V2 order.
    """
    # ── 1. Initialise Supabase if needed ─────────────────────────────────
    if supabase_client is None:
        load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
        load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set.")
        supabase_client = create_client(url, key)

    # ── 2. Ensure departure_time is timezone-aware UTC ───────────────────
    if departure_time.tzinfo is None:
        dt_utc = departure_time.replace(tzinfo=timezone.utc)
    else:
        dt_utc = departure_time.astimezone(timezone.utc)

    # ── 3. Live traffic features via TomTom ──────────────────────────────
    traffic = get_live_traffic_features(origin_lat, origin_lng, dest_lat, dest_lng)
    congestion_ratio = traffic["congestion_ratio"]

    # ── 4. Temporal features ─────────────────────────────────────────────
    hour_fraction = dt_utc.hour + dt_utc.minute / 60.0 + dt_utc.second / 3600.0
    hour_sin = float(np.sin(2 * np.pi * hour_fraction / 24.0))
    hour_cos = float(np.cos(2 * np.pi * hour_fraction / 24.0))
    day_of_week = int(dt_utc.weekday())
    is_weekend = 1 if day_of_week >= 5 else 0
    is_holiday = dt_utc.date() in BENGALURU_HOLIDAYS_2026

    # ── 5. Weather features ──────────────────────────────────────────────
    weather = _fetch_nearest_weather(dt_utc, supabase_client)
    rainfall_mm = float(weather["rainfall_mm"]) if weather["rainfall_mm"] is not None else 0.0
    temperature = float(weather["temperature"]) if weather["temperature"] is not None else 25.0
    condition = str(weather["condition"]) if weather["condition"] is not None else None
    visibility = float(weather["visibility"]) if weather["visibility"] is not None else 10000.0

    # ── 6. Event features (not route-specific for v2, simplified) ────────
    has_event = 0
    distance_to_event_km = 999.0

    # ── 7. Build the row ─────────────────────────────────────────────────
    row_data = {
        "congestion_ratio": float(congestion_ratio),
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "is_holiday": bool(is_holiday),
        "rainfall_mm": rainfall_mm,
        "temperature": temperature,
        "condition": condition,
        "visibility": visibility,
        "has_event": has_event,
        "distance_to_event_km": distance_to_event_km,
    }

    df_row = pd.DataFrame([row_data], columns=FEATURE_COLUMNS_V2)

    # Cast categorical features
    for col in CATEGORICAL_FEATURES_V2:
        if col in _model_categories_v2:
            df_row[col] = pd.Categorical(df_row[col], categories=_model_categories_v2[col])
        else:
            df_row[col] = df_row[col].astype('category')

    return df_row


# ── Public API ───────────────────────────────────────────────────────────────

class ExplanationFactor(dict):
    """Single feature's contribution to the delay prediction."""
    def __init__(self, name: str, value, shap_value_min: float, category: str):
        super().__init__()
        self["name"] = name
        self["value"] = value
        self["shap_value_min"] = shap_value_min
        self["category"] = category

    @property
    def name(self) -> str:
        return self["name"]
    @property
    def value(self):
        return self["value"]
    @property
    def shap_value_min(self) -> float:
        return self["shap_value_min"]
    @property
    def category(self) -> str:
        return self["category"]


def _to_native(v):
    """Convert numpy/pandas types to JSON-safe Python primitives."""
    if isinstance(v, (np.integer, np.int64)):
        return int(v)
    elif isinstance(v, (np.floating, np.float32, np.float64)):
        return float(v)
    elif isinstance(v, (np.bool_, bool)):
        return bool(v)
    elif isinstance(v, pd.Categorical) or hasattr(v, 'categories'):
        return str(v)
    elif pd.isna(v) or v is None:
        return None
    return v


def explain_prediction_v2(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    departure_time: datetime,
    route_name: Optional[str] = None,
    supabase_client: Optional[Client] = None,
) -> dict:
    """
    Generates a structured SHAP-based explanation using Model V2.

    Parameters
    ----------
    origin_lat, origin_lng : float
        Origin coordinates.
    dest_lat, dest_lng : float
        Destination coordinates.
    departure_time : datetime
        Departure timestamp.
    route_name : str, optional
        Human-readable label for the route.
    supabase_client : Client, optional
        Supabase client.

    Returns
    -------
    dict with route_name, predicted_delay_min, base_value_min, factors.
    """
    # 1. Prepare feature row
    feature_row = prepare_feature_row_v2(
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
        departure_time=departure_time,
        supabase_client=supabase_client,
    )

    # 2. Predict
    explainer, bundle = get_explainer_v2()
    model = bundle['model']
    predicted_delay_min = float(model.predict(feature_row)[0])

    # 3. Compute SHAP values
    explanation = explainer(feature_row)
    shap_vals = explanation.values[0]

    # 4. Build factors list, combining hour_sin + hour_cos into "Time of day"
    shap_hour_sin = 0.0
    shap_hour_cos = 0.0

    factors = []
    for idx, col in enumerate(feature_row.columns):
        val = feature_row.iloc[0, idx]
        sv = float(shap_vals[idx])

        if col == "hour_sin":
            shap_hour_sin = sv
            continue
        elif col == "hour_cos":
            shap_hour_cos = sv
            continue

        meta = FEATURE_MAPPING_V2.get(col)
        if meta:
            factors.append(ExplanationFactor(
                name=meta["name"],
                value=_to_native(val),
                shap_value_min=sv,
                category=meta["category"],
            ))

    # Combined time-of-day factor
    factors.append(ExplanationFactor(
        name="Time of day",
        value=departure_time.strftime("%I:%M %p"),
        shap_value_min=shap_hour_sin + shap_hour_cos,
        category="temporal",
    ))

    # 5. Derive base_value_min (forces exact additivity)
    base_value_min = predicted_delay_min - sum(f.shap_value_min for f in factors)

    # 6. Sort by absolute attribution descending
    factors.sort(key=lambda f: abs(f.shap_value_min), reverse=True)

    resolved_name = route_name or f"({origin_lat},{origin_lng}) -> ({dest_lat},{dest_lng})"

    return {
        "route_name": resolved_name,
        "predicted_delay_min": predicted_delay_min,
        "base_value_min": base_value_min,
        "factors": factors,
    }
