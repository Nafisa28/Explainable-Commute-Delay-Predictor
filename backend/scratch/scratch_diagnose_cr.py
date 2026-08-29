"""
Diagnostic script for Model V2 congestion_ratio behavior.
"""

import os
import sys
import joblib
import pandas as pd
import numpy as np

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client

from backend.features.build_features_v2 import build_feature_table_v2
from backend.features.build_from_supabase import fetch_all_rows
from backend.inference.live_traffic_features import get_live_traffic_features

def main():
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

    # 1. Load model artifact
    model_path = os.path.join(PROJECT_ROOT, 'backend', 'model', 'artifacts', 'xgboost_delay_model_v2.pkl')
    bundle = joblib.load(model_path)
    print("=== MODEL ARTIFACT INFO ===")
    print(f"Artifact keys: {list(bundle.keys())}")
    for k, v in bundle.items():
        if k != 'model':
            print(f"  {k}: {v}")
            
    # 2. Fetch Supabase data & build v2 features
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, supabase_key)
    
    traffic_data = fetch_all_rows(supabase, "traffic_logs")
    weather_data = fetch_all_rows(supabase, "weather_logs")
    events_data = fetch_all_rows(supabase, "events")
    
    traffic_df = pd.DataFrame(traffic_data)
    weather_df = pd.DataFrame(weather_data)
    events_df = pd.DataFrame(events_data)
    
    print(f"\nRaw traffic logs count: {len(traffic_df)}")
    
    df_v2 = build_feature_table_v2(traffic_df, weather_df, events_df)
    
    # Check statistics of congestion_ratio and delay_min in training data
    print("\n=== TASK 1: TRAINING DATA STATS (build_features_v2 on Supabase traffic_logs) ===")
    cr = df_v2['congestion_ratio']
    dm = df_v2['delay_min']
    
    print("--- congestion_ratio distribution in training data ---")
    print(cr.describe(percentiles=[0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99]))
    print(f"\n--- delay_min distribution in training data ---")
    print(dm.describe(percentiles=[0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99]))
    
    corr = cr.corr(dm)
    spearman = cr.corr(dm, method='spearman')
    print(f"\nPearson Correlation (congestion_ratio, delay_min):  {corr:.4f}")
    print(f"Spearman Correlation (congestion_ratio, delay_min): {spearman:.4f}")
    
    # Check per route stats: min_travel_time, travel_time range, congestion_ratio range
    print("\n--- Per-Route Baselines and Ranges in Training Data ---")
    route_stats = df_v2.groupby(['route_id', 'path_variant']).agg(
        count=('travel_time_min', 'count'),
        min_tt=('travel_time_min', 'min'),
        max_tt=('travel_time_min', 'max'),
        mean_tt=('travel_time_min', 'mean'),
        min_delay=('delay_min', 'min'),
        max_delay=('delay_min', 'max'),
        mean_delay=('delay_min', 'mean'),
        min_cr=('congestion_ratio', 'min'),
        max_cr=('congestion_ratio', 'max'),
        mean_cr=('congestion_ratio', 'mean'),
        corr=('congestion_ratio', lambda x: x.corr(df_v2.loc[x.index, 'delay_min']))
    )
    print(route_stats.to_string())

    # Task 2 & 3: Compare training data congestion_ratio vs Live TomTom values
    print("\n=== TASK 2 & 3: TRAINING vs LIVE CONGESTION RATIO COMPARISON ===")
    test_routes = [
        {"name": "Whitefield to MG Road", "origin_lat": 12.9698, "origin_lng": 77.7499, "dest_lat": 12.9756, "dest_lng": 77.6068},
        {"name": "Electronic City to Silk Board", "origin_lat": 12.8452, "origin_lng": 77.6602, "dest_lat": 12.9176, "dest_lng": 77.6244},
        {"name": "Koramangala to Indiranagar", "origin_lat": 12.9352, "origin_lng": 77.6244, "dest_lat": 12.9719, "dest_lng": 77.6412}
    ]
    
    for r in test_routes:
        live_feat = get_live_traffic_features(r['origin_lat'], r['origin_lng'], r['dest_lat'], r['dest_lng'])
        print(f"\nRoute: {r['name']}")
        print(f"  Live Travel Time (TomTom):      {live_feat['live_travel_time_min']:.2f} min")
        print(f"  Free Flow Time (TomTom noTraffic): {live_feat['free_flow_travel_time_min']:.2f} min")
        print(f"  TomTom congestion_ratio:        {live_feat['congestion_ratio']:.4f}")
        print(f"  TomTom implied delay:           {live_feat['live_travel_time_min'] - live_feat['free_flow_travel_time_min']:.2f} min")

    # Let's inspect how the tree model splits on congestion_ratio
    print("\n=== TREE SPLIT ANALYSIS ON congestion_ratio ===")
    model = bundle['model']
    booster = model.get_booster()
    trees_df = booster.trees_to_dataframe()
    cr_splits = trees_df[trees_df['Feature'] == 'congestion_ratio']
    print(f"Total nodes splitting on congestion_ratio: {len(cr_splits)} across all trees")
    print(cr_splits[['Tree', 'Node', 'Split', 'Gain', 'Cover']].head(30).to_string())

if __name__ == '__main__':
    main()
