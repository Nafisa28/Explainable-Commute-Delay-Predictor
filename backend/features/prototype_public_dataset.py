"""
prototype_public_dataset.py
===========================
Validates the feature engineering pipeline end-to-end using a realistic
synthetic traffic dataset modeled after public benchmarks (METR-LA / PeMS).

Generates ~23,000 rows of traffic data across 8 routes x 2 path variants,
with realistic rush-hour patterns, weekend effects, and random noise.
Also generates matching synthetic weather observations.

Usage (from project root):
    python -m backend.features.prototype_public_dataset
"""

import sys
import os
import numpy as np
import pandas as pd

# Ensure project root is on sys.path for package imports
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.features.build_features import build_feature_table


# ---------------------------------------------------------------------------
# Synthetic data generators
# ---------------------------------------------------------------------------

def generate_synthetic_traffic(
    n_routes: int = 8,
    n_variants: int = 2,
    n_days: int = 30,
    interval_minutes: int = 30,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate a realistic synthetic traffic log DataFrame.

    Mimics METR-LA patterns: multiple sensor/route IDs, 5-min or 30-min
    intervals, travel times that vary by time-of-day and day-of-week.
    """
    rng = np.random.default_rng(seed)

    # Base travel times per route (minutes) -- roughly 15-45 min like Bengaluru commutes
    base_times = rng.uniform(15, 45, size=n_routes)

    # Route and variant labels
    route_ids = [f"route-{i:03d}" for i in range(n_routes)]
    variant_labels = [f"variant-{chr(65 + v)}" for v in range(n_variants)]

    # Timestamps: every interval_minutes for n_days
    start = pd.Timestamp("2026-03-01", tz="UTC")
    timestamps = pd.date_range(start, periods=n_days * (24 * 60 // interval_minutes), freq=f"{interval_minutes}min")

    rows = []
    for r_idx, route_id in enumerate(route_ids):
        base = base_times[r_idx]
        for variant in variant_labels:
            # Small per-variant offset
            variant_offset = rng.uniform(-2, 2)
            for ts in timestamps:
                hour = ts.hour + ts.minute / 60.0
                dow = ts.dayofweek

                # Rush-hour multiplier: peaks at 8:30 AM and 6 PM
                morning_peak = 1.0 + 0.6 * np.exp(-0.5 * ((hour - 8.5) / 1.0) ** 2)
                evening_peak = 1.0 + 0.5 * np.exp(-0.5 * ((hour - 18.0) / 1.2) ** 2)
                rush_mult = max(morning_peak, evening_peak)

                # Weekend reduction (20-30% less congestion)
                if dow >= 5:
                    rush_mult = 1.0 + (rush_mult - 1.0) * 0.3

                # Random noise (+/-10%)
                noise = rng.normal(1.0, 0.05)

                travel_time = max(5.0, (base + variant_offset) * rush_mult * noise)
                distance_km = base * 0.8 + rng.normal(0, 0.5)  # rough proxy

                rows.append({
                    "route_id": route_id,
                    "path_variant": variant,
                    "timestamp": ts.isoformat(),
                    "travel_time_min": round(travel_time, 2),
                    "distance_km": round(max(1.0, distance_km), 2),
                })

    return pd.DataFrame(rows)


def generate_synthetic_weather(
    n_days: int = 30,
    interval_minutes: int = 30,
    seed: int = 123,
) -> pd.DataFrame:
    """Generate synthetic weather observations matching the traffic time range."""
    rng = np.random.default_rng(seed)

    start = pd.Timestamp("2026-03-01", tz="UTC")
    timestamps = pd.date_range(start, periods=n_days * (24 * 60 // interval_minutes), freq=f"{interval_minutes}min")

    conditions = ["Clear", "Clouds", "Rain", "Drizzle", "Mist", "Haze"]
    weights = [0.35, 0.30, 0.15, 0.08, 0.07, 0.05]

    rows = []
    for ts in timestamps:
        cond = rng.choice(conditions, p=weights)
        rainfall = round(rng.exponential(2.0), 1) if cond in ("Rain", "Drizzle") else 0.0
        temp = round(rng.normal(28.0, 3.0), 1)  # Bengaluru-like temps
        vis = int(rng.normal(8000, 2000))
        rows.append({
            "timestamp": ts.isoformat(),
            "rainfall_mm": rainfall,
            "temperature": temp,
            "condition": cond,
            "visibility": max(500, vis),
        })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 70)
    print("  Prototype Public Dataset -- Feature Pipeline Validation")
    print("=" * 70)

    # 1. Generate synthetic data
    print("\n[1/4] Generating synthetic traffic data (METR-LA-inspired)...")
    traffic_df = generate_synthetic_traffic()
    print(f"      -> {len(traffic_df):,} traffic log rows")
    print(f"      -> {traffic_df['route_id'].nunique()} routes x {traffic_df['path_variant'].nunique()} variants")
    print(f"      -> Date range: {traffic_df['timestamp'].min()} to {traffic_df['timestamp'].max()}")

    print("\n[2/4] Generating synthetic weather data...")
    weather_df = generate_synthetic_weather()
    print(f"      -> {len(weather_df):,} weather log rows")

    # Empty events table (matching schema)
    events_df = pd.DataFrame(columns=["id", "name", "date", "route_ids_affected", "event_type", "distance_to_route_km"])

    # 2. Run feature engineering
    print("\n[3/4] Running build_feature_table()...")
    feature_df = build_feature_table(traffic_df, weather_df, events_df)
    print(f"      -> Output: {len(feature_df):,} rows x {len(feature_df.columns)} columns")

    # 3. Validate output columns
    print("\n[4/4] Validating output columns...")
    expected_columns = [
        "hour_sin", "hour_cos", "day_of_week", "is_weekend", "is_holiday",
        "rainfall_mm", "temperature", "condition", "visibility",
        "has_event", "event_type", "distance_to_event_km",
        "last_observed_travel_time", "historical_avg_delay",
        "delay_min",
    ]

    missing = [c for c in expected_columns if c not in feature_df.columns]
    if missing:
        print(f"      [FAIL] MISSING columns: {missing}")
    else:
        print(f"      [OK] All {len(expected_columns)} expected feature columns present")

    # 4. Print summary stats
    print("\n" + "-" * 70)
    print("  Feature Table Summary")
    print("-" * 70)
    print(f"\n  Shape: {feature_df.shape}")
    print(f"\n  Columns:\n    {list(feature_df.columns)}")

    print(f"\n  Temporal features:")
    print(f"    hour_sin  range:  [{feature_df['hour_sin'].min():.3f}, {feature_df['hour_sin'].max():.3f}]")
    print(f"    hour_cos  range:  [{feature_df['hour_cos'].min():.3f}, {feature_df['hour_cos'].max():.3f}]")
    print(f"    day_of_week:      {sorted(feature_df['day_of_week'].unique())}")
    print(f"    is_weekend:       {feature_df['is_weekend'].value_counts().to_dict()}")
    print(f"    is_holiday:       {feature_df['is_holiday'].value_counts().to_dict()}")

    print(f"\n  Weather features:")
    print(f"    rainfall_mm:      mean={feature_df['rainfall_mm'].mean():.2f}, max={feature_df['rainfall_mm'].max():.1f}")
    print(f"    temperature:      mean={feature_df['temperature'].mean():.1f}, std={feature_df['temperature'].std():.1f}")
    print(f"    condition:        {feature_df['condition'].value_counts().to_dict()}")
    print(f"    visibility nulls: {feature_df['visibility'].isna().sum()}")

    print(f"\n  Lag features:")
    non_null_hist = feature_df['historical_avg_delay'].notna().sum()
    non_null_last = feature_df['last_observed_travel_time'].notna().sum()
    total = len(feature_df)
    print(f"    historical_avg_delay:      {non_null_hist:,}/{total:,} non-null ({100*non_null_hist/total:.1f}%)")
    print(f"    last_observed_travel_time: {non_null_last:,}/{total:,} non-null ({100*non_null_last/total:.1f}%)")

    print(f"\n  Target variable:")
    print(f"    delay_min:  mean={feature_df['delay_min'].mean():.2f}, max={feature_df['delay_min'].max():.2f}, min={feature_df['delay_min'].min():.2f}")

    print(f"\n  Events features:")
    print(f"    has_event:   {feature_df['has_event'].value_counts().to_dict()}")

    print("\n" + "=" * 70)
    if not missing:
        print("  [PASS] PIPELINE VALIDATION PASSED -- all features computed successfully")
    else:
        print("  [FAIL] PIPELINE VALIDATION FAILED -- missing columns listed above")
    print("=" * 70)


if __name__ == "__main__":
    main()
