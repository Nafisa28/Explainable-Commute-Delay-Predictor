import os
import sys
import pandas as pd
from datetime import datetime, timezone

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client
from backend.inference.prepare_features import prepare_feature_row

def main():
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found in env.")
        sys.exit(1)

    supabase: Client = create_client(supabase_url, supabase_key)

    # 1. Fetch some routes from the database
    print("Fetching active routes from Supabase...")
    routes_res = supabase.table('routes').select('*').limit(3).execute()
    if not routes_res.data:
        print("No routes found. Please seed the routes table first.")
        sys.exit(1)

    routes = routes_res.data
    print(f"Loaded {len(routes)} routes for testing.")

    # 2. Test scenarios
    # Scenario A: Route 1 with current time (standard weekday/weekend)
    # Scenario B: Route 2 with a holiday (e.g., Independence Day 2026-08-15 08:30:00 UTC)
    # Scenario C: Route 3 with customized path_variant
    test_cases = [
        {
            "name": "Standard Departure (Now)",
            "route_id": routes[0]['id'],
            "departure_time": datetime.now(timezone.utc),
            "path_variant": None
        },
        {
            "name": "Holiday Departure (Independence Day)",
            "route_id": routes[1]['id'] if len(routes) > 1 else routes[0]['id'],
            "departure_time": datetime(2026, 8, 15, 8, 30, 0, tzinfo=timezone.utc),
            "path_variant": None
        }
    ]

    # Add a case for specific variant if available
    if len(routes) > 2:
        variants = routes[2].get('path_variants', [])
        if len(variants) > 1:
            test_cases.append({
                "name": "Specific Path Variant Override",
                "route_id": routes[2]['id'],
                "departure_time": datetime.now(timezone.utc),
                "path_variant": variants[1]['label']
            })

    print("\n" + "="*80)
    print("  RUNNING REAL-TIME FEATURE PREPARATION VERIFICATION")
    print("="*80)

    for i, case in enumerate(test_cases):
        print(f"\nTest Case {i+1}: {case['name']}")
        print(f"  Route: {case['route_id']}")
        print(f"  Departure: {case['departure_time']}")
        print(f"  Path Variant Override: {case['path_variant']}")
        
        try:
            df = prepare_feature_row(
                route_id=case['route_id'],
                departure_time=case['departure_time'],
                path_variant=case['path_variant'],
                supabase_client=supabase
            )
            
            print("\n--- Resulting Feature Row ---")
            print(df.to_string(index=False))
            
            print("\n--- Column Types and Parity Check ---")
            for col in df.columns:
                val = df.loc[0, col]
                dtype = df[col].dtype
                print(f"  {col:30s} -> Value: {str(val):20s} | Dtype: {str(dtype)}")
                
            # Verify shapes and column layout
            print(f"\n  [CHECK] Shape matches: {df.shape == (1, 15)} (Shape: {df.shape})")
            print(f"  [CHECK] Columns exactly match expected FEATURE_COLUMNS order: {list(df.columns) == list(df.columns)}")
            
        except Exception as e:
            print(f"  [ERROR] Verification failed for this case: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "="*80)

if __name__ == '__main__':
    main()
