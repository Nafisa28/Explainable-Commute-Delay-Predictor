"""
train_model_v2.py
=================
Trains an XGBoost Regressor using route-agnostic, generalizable features (v2),
specifically using congestion_ratio as the primary congestion feature.
Compares performance directly against the previous route-memorized model
and a baseline model.

Usage:
    python -m backend.model.train_model_v2 --data-source synthetic
    python -m backend.model.train_model_v2 --data-source supabase
"""

import argparse
import sys
import os
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error
import xgboost as xgb

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client

from backend.features.build_features import build_feature_table
from backend.features.build_features_v2 import build_feature_table_v2
from backend.features.prototype_public_dataset import generate_synthetic_traffic, generate_synthetic_weather
from backend.features.build_from_supabase import fetch_all_rows
from backend.model.constants import FEATURE_COLUMNS as FEATURE_COLUMNS_V1, CATEGORICAL_FEATURES as CATEGORICAL_FEATURES_V1

# Define new generalizable features
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


def load_raw_data(data_source: str) -> tuple:
    """Loads raw dataframes from either synthetic generator or Supabase."""
    if data_source == "synthetic":
        print("Loading synthetic data sources...")
        traffic_df = generate_synthetic_traffic(n_days=45)
        weather_df = generate_synthetic_weather(n_days=45)
        events_df = pd.DataFrame(columns=["id", "name", "date", "route_ids_affected", "event_type", "distance_to_route_km"])
    else:
        load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
        load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            print("Error: SUPABASE_URL and SUPABASE_KEY must be set in the environment.")
            sys.exit(1)

        print("Connecting to Supabase...")
        supabase: Client = create_client(supabase_url, supabase_key)

        print("Fetching traffic_logs...")
        traffic_data = fetch_all_rows(supabase, "traffic_logs")
        traffic_df = pd.DataFrame(traffic_data)

        if traffic_df.empty:
            print("Error: No traffic data in Supabase. Cannot train model.")
            sys.exit(1)

        print("Fetching weather_logs...")
        weather_data = fetch_all_rows(supabase, "weather_logs")
        weather_df = pd.DataFrame(weather_data)

        print("Fetching events...")
        events_data = fetch_all_rows(supabase, "events")
        events_df = pd.DataFrame(events_data)

    return traffic_df, weather_df, events_df


def main():
    parser = argparse.ArgumentParser(description="Train XGBoost delay prediction model v2.")
    parser.add_argument(
        "--data-source",
        choices=["synthetic", "supabase"],
        default="synthetic",
        help="Source of training data (default: synthetic)"
    )
    args = parser.parse_args()

    print("=" * 70)
    print(f"  Training Model V2 (Generalizable) -- Source: {args.data_source.upper()}")
    print("=" * 70)

    # 1. Load raw data
    traffic_df, weather_df, events_df = load_raw_data(args.data_source)

    # 2. Build both old (v1) and new (v2) features
    print("Building features (v1)...")
    df_v1 = build_feature_table(traffic_df, weather_df, events_df)
    
    print("Building features (v2)...")
    df_v2 = build_feature_table_v2(traffic_df, weather_df, events_df)

    # 3. Sort and split (using identical indices/timestamps)
    df_v1['timestamp'] = pd.to_datetime(df_v1['timestamp'], utc=True)
    df_v1 = df_v1.sort_values('timestamp').reset_index(drop=True)
    
    df_v2['timestamp'] = pd.to_datetime(df_v2['timestamp'], utc=True)
    df_v2 = df_v2.sort_values('timestamp').reset_index(drop=True)

    split_idx = int(len(df_v1) * 0.8)
    
    train_df_v1 = df_v1.iloc[:split_idx].copy()
    test_df_v1 = df_v1.iloc[split_idx:].copy()
    
    train_df_v2 = df_v2.iloc[:split_idx].copy()
    test_df_v2 = df_v2.iloc[split_idx:].copy()

    # Preprocess helper for v1
    mean_travel_time_train_v1 = train_df_v1['travel_time_min'].mean()
    min_time_map_v1 = train_df_v1.groupby(['route_id', 'path_variant'])['travel_time_min'].min().to_dict()
    mean_delay_train_v1 = train_df_v1['delay_min'].mean()

    def preprocess_v1(data_df):
        out_df = data_df.copy()
        for col in CATEGORICAL_FEATURES_V1:
            out_df[col] = out_df[col].astype('category')
        out_df['rainfall_mm'] = out_df['rainfall_mm'].fillna(0.0)
        out_df['temperature'] = out_df['temperature'].fillna(25.0)
        out_df['visibility'] = out_df['visibility'].fillna(10000.0)
        out_df['distance_to_event_km'] = out_df['distance_to_event_km'].fillna(999.0)
        out_df['has_event'] = out_df['has_event'].fillna(0)
        out_df['last_observed_travel_time'] = out_df['last_observed_travel_time'].fillna(mean_travel_time_train_v1)
        out_df['historical_avg_delay'] = out_df['historical_avg_delay'].fillna(0.0)
        return out_df

    # Preprocess helper for v2
    def preprocess_v2(data_df):
        out_df = data_df.copy()
        for col in CATEGORICAL_FEATURES_V2:
            out_df[col] = out_df[col].astype('category')
        out_df['rainfall_mm'] = out_df['rainfall_mm'].fillna(0.0)
        out_df['temperature'] = out_df['temperature'].fillna(25.0)
        out_df['visibility'] = out_df['visibility'].fillna(10000.0)
        out_df['distance_to_event_km'] = out_df['distance_to_event_km'].fillna(999.0)
        out_df['has_event'] = out_df['has_event'].fillna(0)
        out_df['congestion_ratio'] = out_df['congestion_ratio'].fillna(1.0)
        return out_df

    train_prepped_v1 = preprocess_v1(train_df_v1)
    test_prepped_v1 = preprocess_v1(test_df_v1)
    
    train_prepped_v2 = preprocess_v2(train_df_v2)
    test_prepped_v2 = preprocess_v2(test_df_v2)

    # 4. Compute baseline predictions (same logic as v1)
    def get_baseline_pred(row):
        hist_avg = row['historical_avg_delay']
        route = row['route_id']
        variant = row['path_variant']
        if pd.isna(hist_avg) or hist_avg == 0.0:
            return mean_delay_train_v1
        min_time = min_time_map_v1.get((route, variant))
        if min_time is None:
            return mean_delay_train_v1
        return max(0.0, hist_avg - min_time)

    test_baseline_preds = test_df_v1.apply(get_baseline_pred, axis=1)

    # 5. Train Model V1 (Route-memorized)
    print("\nTraining Model V1 (Route-memorized)...")
    X_train_v1 = train_prepped_v1[FEATURE_COLUMNS_V1]
    y_train_v1 = train_prepped_v1['delay_min']
    X_test_v1 = test_prepped_v1[FEATURE_COLUMNS_V1]
    y_test_v1 = test_prepped_v1['delay_min']

    model_v1 = xgb.XGBRegressor(
        n_estimators=120,
        learning_rate=0.04,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        enable_categorical=True
    )
    model_v1.fit(X_train_v1, y_train_v1)

    # 6. Train Model V2 (Generalizable)
    print("Training Model V2 (Generalizable)...")
    X_train_v2 = train_prepped_v2[FEATURE_COLUMNS_V2]
    y_train_v2 = train_prepped_v2['delay_min']
    X_test_v2 = test_prepped_v2[FEATURE_COLUMNS_V2]
    y_test_v2 = test_prepped_v2['delay_min']

    model_v2 = xgb.XGBRegressor(
        n_estimators=120,
        learning_rate=0.04,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        enable_categorical=True
    )
    model_v2.fit(X_train_v2, y_train_v2)

    # 7. Evaluate both models
    baseline_mae = mean_absolute_error(y_test_v1, test_baseline_preds)
    xgb_v1_preds = model_v1.predict(X_test_v1)
    xgb_v1_mae = mean_absolute_error(y_test_v1, xgb_v1_preds)
    
    xgb_v2_preds = model_v2.predict(X_test_v2)
    xgb_v2_mae = mean_absolute_error(y_test_v2, xgb_v2_preds)

    imp_v1 = 100.0 * (baseline_mae - xgb_v1_mae) / baseline_mae if baseline_mae > 0 else 0.0
    imp_v2 = 100.0 * (baseline_mae - xgb_v2_mae) / baseline_mae if baseline_mae > 0 else 0.0
    diff_mae = xgb_v2_mae - xgb_v1_mae
    pct_difference = 100.0 * diff_mae / xgb_v1_mae if xgb_v1_mae > 0 else 0.0

    print("\n" + "=" * 70)
    print("  MODEL COMPARISON REPORT")
    print("=" * 70)
    print(f"  Baseline Model MAE:           {baseline_mae:.4f} min")
    print(f"  Model V1 (Route-memorized) MAE: {xgb_v1_mae:.4f} min (Improvement: {imp_v1:.2f}%)")
    print(f"  Model V2 (Generalizable) MAE:   {xgb_v2_mae:.4f} min (Improvement: {imp_v2:.2f}%)")
    print("-" * 70)
    print(f"  Absolute Difference (V2 - V1):  {diff_mae:+.4f} min")
    print(f"  Percentage Difference (vs V1):  {pct_difference:+.2f}%")
    
    if diff_mae <= 0:
        print("  Status: V2 (Generalizable) is BETTER or EQUAL in accuracy to V1!")
    else:
        print("  Status: V2 (Generalizable) shows a minor accuracy trade-off for full generalizability.")
    print("=" * 70)

    # 8. Save the new model artifact
    artifacts_dir = os.path.join(PROJECT_ROOT, 'backend', 'model', 'artifacts')
    os.makedirs(artifacts_dir, exist_ok=True)
    model_path_v2 = os.path.join(artifacts_dir, 'xgboost_delay_model_v2.pkl')

    model_bundle_v2 = {
        "model": model_v2,
        "features": FEATURE_COLUMNS_V2,
        "categorical_features": CATEGORICAL_FEATURES_V2,
        "trained_on": args.data_source,
        "date_trained": pd.Timestamp.now().isoformat()
    }
    joblib.dump(model_bundle_v2, model_path_v2)
    print(f"\nModel V2 artifact successfully saved to:\n  {model_path_v2}")
    print("=" * 70)


if __name__ == "__main__":
    main()
