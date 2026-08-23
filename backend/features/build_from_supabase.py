"""
build_from_supabase.py
======================
Pulls live traffic_logs, weather_logs, and events data from Supabase,
runs it through the feature engineering pipeline, and prints a detailed
summary to assess readiness for model training.

Usage (from project root):
    python -m backend.features.build_from_supabase
"""

import sys
import os
import pandas as pd

# Ensure project root is on sys.path for package imports
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client
from backend.features.build_features import build_feature_table

# Load environment variables
env_paths = [
    os.path.join(PROJECT_ROOT, 'backend', '.env'),
    os.path.join(PROJECT_ROOT, '.env'),
]
for path in env_paths:
    if os.path.exists(path):
        load_dotenv(dotenv_path=path)
        break


def fetch_all_rows(supabase: Client, table: str, order_col: str = "id") -> list:
    """
    Fetch all rows from a Supabase table, paginating in batches of 1000
    to work around the default API limit.
    """
    all_data = []
    batch_size = 1000
    offset = 0

    while True:
        response = (
            supabase.table(table)
            .select("*")
            .order(order_col)
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        batch = response.data
        if not batch:
            break
        all_data.extend(batch)
        if len(batch) < batch_size:
            break
        offset += batch_size

    return all_data


def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in the environment.")
        sys.exit(1)

    supabase: Client = create_client(supabase_url, supabase_key)

    print("=" * 70)
    print("  Build Features from Supabase -- Live Data Pipeline")
    print("=" * 70)

    # 1. Fetch traffic_logs
    print("\n[1/5] Fetching traffic_logs...")
    traffic_data = fetch_all_rows(supabase, "traffic_logs")
    traffic_df = pd.DataFrame(traffic_data)
    print(f"      -> {len(traffic_df):,} rows")

    if traffic_df.empty:
        print("\n  [FAIL] No traffic data found. Cannot build features.")
        print("    Run the data collection workflow first (collect_traffic.py).")
        sys.exit(0)

    # 2. Fetch weather_logs
    print("\n[2/5] Fetching weather_logs...")
    weather_data = fetch_all_rows(supabase, "weather_logs")
    weather_df = pd.DataFrame(weather_data)
    print(f"      -> {len(weather_df):,} rows")

    # 3. Fetch events
    print("\n[3/5] Fetching events...")
    events_data = fetch_all_rows(supabase, "events")
    events_df = pd.DataFrame(events_data)
    print(f"      -> {len(events_df):,} rows")

    # 4. Run feature engineering
    print("\n[4/5] Running build_feature_table()...")
    feature_df = build_feature_table(traffic_df, weather_df, events_df)
    print(f"      -> Output: {len(feature_df):,} rows x {len(feature_df.columns)} columns")

    # 5. Print detailed summary
    print("\n[5/5] Summary Report")
    print("\n" + "-" * 70)
    print("  Raw Data Overview")
    print("-" * 70)

    # Date range
    traffic_df['timestamp'] = pd.to_datetime(traffic_df['timestamp'], utc=True)
    date_min = traffic_df['timestamp'].min()
    date_max = traffic_df['timestamp'].max()
    date_span = (date_max - date_min).days
    print(f"\n  Date range:         {date_min.strftime('%Y-%m-%d %H:%M')} -> {date_max.strftime('%Y-%m-%d %H:%M')}")
    print(f"  Span:               {date_span} days")

    # Route/variant combos
    combos = traffic_df.groupby(['route_id', 'path_variant']).size().reset_index(name='count')
    print(f"\n  Unique route_ids:           {traffic_df['route_id'].nunique()}")
    print(f"  Unique path_variants:       {traffic_df['path_variant'].nunique()}")
    print(f"  Unique (route, variant):    {len(combos)}")
    print(f"\n  Rows per (route, variant):")
    for _, row in combos.iterrows():
        rid = str(row['route_id'])
        rid_short = rid[:8] + "..." if len(rid) > 8 else rid
        print(f"    {rid_short} / {str(row['path_variant']):20s} -> {row['count']:,} rows")

    # Weather coverage
    if not weather_df.empty:
        weather_df['timestamp'] = pd.to_datetime(weather_df['timestamp'], utc=True)
        print(f"\n  Weather date range: {weather_df['timestamp'].min().strftime('%Y-%m-%d %H:%M')} -> {weather_df['timestamp'].max().strftime('%Y-%m-%d %H:%M')}")
    else:
        print(f"\n  Weather: NO DATA (weather features will be NaN)")

    # Events
    print(f"  Events:             {len(events_df)} rows")

    print("\n" + "-" * 70)
    print("  Feature Table Quality")
    print("-" * 70)

    # Feature completeness
    expected_columns = [
        "hour_sin", "hour_cos", "day_of_week", "is_weekend", "is_holiday",
        "rainfall_mm", "temperature", "condition", "visibility",
        "has_event",
        "last_observed_travel_time", "historical_avg_delay",
        "delay_min",
    ]

    missing_cols = [c for c in expected_columns if c not in feature_df.columns]
    if missing_cols:
        print(f"\n  [FAIL] Missing columns: {missing_cols}")
    else:
        print(f"\n  [OK] All {len(expected_columns)} expected feature columns present")

    # Null analysis for key features
    print(f"\n  Feature completeness (non-null counts):")
    for col in expected_columns:
        if col in feature_df.columns:
            non_null = feature_df[col].notna().sum()
            pct = 100 * non_null / len(feature_df) if len(feature_df) > 0 else 0
            status = "[OK]" if pct > 50 else "[!!]" if pct > 0 else "[--]"
            print(f"    {status} {col:30s} {non_null:>6,}/{len(feature_df):,} ({pct:5.1f}%)")

    # Lag feature coverage per route/variant
    print(f"\n  Lag feature coverage by (route, variant):")
    lag_summary = feature_df.groupby(['route_id', 'path_variant']).agg(
        total=('delay_min', 'count'),
        hist_avg_non_null=('historical_avg_delay', lambda x: x.notna().sum()),
        last_obs_non_null=('last_observed_travel_time', lambda x: x.notna().sum()),
    ).reset_index()

    combos_with_hist = (lag_summary['hist_avg_non_null'] > 0).sum()
    combos_with_last = (lag_summary['last_obs_non_null'] > 0).sum()
    total_combos = len(lag_summary)
    print(f"    Combos with historical_avg_delay > 0: {combos_with_hist}/{total_combos}")
    print(f"    Combos with last_observed_travel_time > 0: {combos_with_last}/{total_combos}")

    # Target variable
    if 'delay_min' in feature_df.columns:
        print(f"\n  Target variable (delay_min):")
        print(f"    mean:  {feature_df['delay_min'].mean():.2f} min")
        print(f"    std:   {feature_df['delay_min'].std():.2f} min")
        print(f"    min:   {feature_df['delay_min'].min():.2f} min")
        print(f"    max:   {feature_df['delay_min'].max():.2f} min")

    # Training readiness assessment
    print("\n" + "-" * 70)
    print("  Training Readiness Assessment")
    print("-" * 70)

    issues = []
    if len(feature_df) < 500:
        issues.append(f"Only {len(feature_df)} rows -- need at least 500 for meaningful training")
    if date_span < 7:
        issues.append(f"Only {date_span} days of data -- need at least 7 for day-of-week patterns")
    if weather_df.empty:
        issues.append("No weather data -- weather features will all be NaN")
    if combos_with_hist < total_combos:
        issues.append(f"Only {combos_with_hist}/{total_combos} route/variant combos have historical lag data")

    if issues:
        print(f"\n  [!!] Not yet ready for training:")
        for issue in issues:
            print(f"    - {issue}")
        print(f"\n  Recommendation: Continue collecting data. Current pace:")
        rows_per_day = len(traffic_df) / max(1, date_span)
        print(f"    ~{rows_per_day:.0f} traffic rows/day")
        if rows_per_day > 0:
            days_to_500 = max(0, (500 - len(traffic_df)) / rows_per_day)
            print(f"    ~{days_to_500:.0f} more days to reach 500 rows (if not already there)")
    else:
        print(f"\n  [OK] Data looks ready for initial model training!")
        print(f"    {len(feature_df):,} rows, {date_span} days, {total_combos} route/variant combos")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
