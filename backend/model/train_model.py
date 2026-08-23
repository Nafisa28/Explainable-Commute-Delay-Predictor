"""
train_model.py
==============
Trains an XGBoost Regressor to predict commute delay_min.
Supports synthetic validation data or live data pulled from Supabase.

Usage:
    # Train using synthetic data (default)
    python -m backend.model.train_model --data-source synthetic

    # Train using live Supabase data
    python -m backend.model.train_model --data-source supabase
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
from backend.features.prototype_public_dataset import generate_synthetic_traffic, generate_synthetic_weather
from backend.features.build_from_supabase import fetch_all_rows
from backend.model.constants import FEATURE_COLUMNS, CATEGORICAL_FEATURES


def load_synthetic_data() -> pd.DataFrame:
    """Generate synthetic traffic, weather, and events logs, then build feature table."""
    print("Loading synthetic data sources...")
    traffic_df = generate_synthetic_traffic(n_days=45) # 45 days for more robust split
    weather_df = generate_synthetic_weather(n_days=45)
    events_df = pd.DataFrame(columns=["id", "name", "date", "route_ids_affected", "event_type", "distance_to_route_km"])
    
    print("Building features...")
    df = build_feature_table(traffic_df, weather_df, events_df)
    return df


def load_supabase_data() -> pd.DataFrame:
    """Pull live tables from Supabase and build the feature table."""
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

    print("Building features...")
    df = build_feature_table(traffic_df, weather_df, events_df)
    return df


def preprocess_split_data(df: pd.DataFrame):
    """
    Sorts by timestamp and splits 80/20 time-based.
    Performs clean preprocessing (filling nulls) to avoid temporal leakage.
    """
    # Ensure sorted by time
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
    df = df.sort_values('timestamp').reset_index(drop=True)

    # 80/20 split
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    print(f"Data split:")
    print(f"  Train set: {len(train_df):,} rows ({train_df['timestamp'].min()} to {train_df['timestamp'].max()})")
    print(f"  Test set:  {len(test_df):,} rows ({test_df['timestamp'].min()} to {test_df['timestamp'].max()})")

    # Compute baseline minimums from training set only
    min_time_map = train_df.groupby(['route_id', 'path_variant'])['travel_time_min'].min().to_dict()
    mean_travel_time_train = train_df['travel_time_min'].mean()
    mean_delay_train = train_df['delay_min'].mean()

    # Preprocess helper
    def preprocess_df(data_df):
        out_df = data_df.copy()
        
        # Cast categorical types
        for col in CATEGORICAL_FEATURES:
            out_df[col] = out_df[col].astype('category')
            
        # Fill standard weather/event nulls
        out_df['rainfall_mm'] = out_df['rainfall_mm'].fillna(0.0)
        out_df['temperature'] = out_df['temperature'].fillna(25.0)
        out_df['visibility'] = out_df['visibility'].fillna(10000.0)
        out_df['distance_to_event_km'] = out_df['distance_to_event_km'].fillna(999.0)
        out_df['has_event'] = out_df['has_event'].fillna(0)

        # Fill lag features safely
        out_df['last_observed_travel_time'] = out_df['last_observed_travel_time'].fillna(mean_travel_time_train)
        out_df['historical_avg_delay'] = out_df['historical_avg_delay'].fillna(0.0)
        
        return out_df

    train_prepped = preprocess_df(train_df)
    test_prepped = preprocess_df(test_df)

    # Calculate baseline predictions
    # Baseline = historical_avg_delay minus route-variant minimum time (free-flow baseline)
    # If hist avg is 0 or NaN, predict overall train delay mean
    def get_baseline_pred(row):
        hist_avg = row['historical_avg_delay']
        route = row['route_id']
        variant = row['path_variant']
        
        # If historical_avg_delay was filled with 0.0 or is NaN, fallback to mean
        if pd.isna(hist_avg) or hist_avg == 0.0:
            return mean_delay_train
            
        min_time = min_time_map.get((route, variant))
        if min_time is None:
            return mean_delay_train
            
        return max(0.0, hist_avg - min_time)

    test_baseline_preds = test_df.apply(get_baseline_pred, axis=1)

    return train_prepped, test_prepped, test_baseline_preds


def main():
    parser = argparse.ArgumentParser(description="Train XGBoost delay prediction model.")
    parser.add_argument(
        "--data-source",
        choices=["synthetic", "supabase"],
        default="synthetic",
        help="Source of training data (default: synthetic)"
    )
    args = parser.parse_args()

    print("=" * 70)
    print(f"  Training Model -- Data Source: {args.data_source.upper()}")
    print("=" * 70)

    # 1. Load data
    if args.data_source == "synthetic":
        df = load_synthetic_data()
    else:
        df = load_supabase_data()

    # 2. Preprocess and split
    train_df, test_df, test_baseline_preds = preprocess_split_data(df)

    # Prepare features/targets
    X_train = train_df[FEATURE_COLUMNS]
    y_train = train_df['delay_min']
    X_test = test_df[FEATURE_COLUMNS]
    y_test = test_df['delay_min']

    # 3. Train XGBoost model
    print("\nTraining XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=120,
        learning_rate=0.04,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        enable_categorical=True  # Enables native pandas category support
    )
    model.fit(X_train, y_train)
    print("XGBoost training completed.")

    # 4. Evaluate
    print("\nEvaluating model performance on test set...")
    xgb_preds = model.predict(X_test)
    
    xgb_mae = mean_absolute_error(y_test, xgb_preds)
    baseline_mae = mean_absolute_error(y_test, test_baseline_preds)
    
    improvement = 100.0 * (baseline_mae - xgb_mae) / baseline_mae if baseline_mae > 0 else 0.0

    print("-" * 70)
    print(f"  Baseline Model MAE:   {baseline_mae:.4f} min")
    print(f"  XGBoost Regressor MAE: {xgb_mae:.4f} min")
    if baseline_mae > 0:
        print(f"  Improvement:          {improvement:.2f}%")
    else:
        print("  Improvement:          N/A (no baseline delay variation)")
    print("-" * 70)

    # 5. Save model artifact
    artifacts_dir = os.path.join(PROJECT_ROOT, 'backend', 'model', 'artifacts')
    os.makedirs(artifacts_dir, exist_ok=True)
    model_path = os.path.join(artifacts_dir, 'xgboost_delay_model.pkl')
    
    # Save the model dictionary including metadata
    model_bundle = {
        "model": model,
        "features": FEATURE_COLUMNS,
        "categorical_features": CATEGORICAL_FEATURES,
        "trained_on": args.data_source,
        "date_trained": pd.Timestamp.now().isoformat()
    }
    
    joblib.dump(model_bundle, model_path)
    print(f"\nModel artifact successfully saved to:")
    print(f"  {model_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
