import os
import sys
import json
from datetime import datetime, timezone

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client
from backend.explainability.shap_explainer import explain_prediction

def main():
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found in env.")
        sys.exit(1)

    supabase: Client = create_client(supabase_url, supabase_key)

    # Fetch active routes
    routes_res = supabase.table('routes').select('*').limit(3).execute()
    if not routes_res.data:
        print("No routes found.")
        sys.exit(1)

    routes = routes_res.data
    print(f"Loaded {len(routes)} routes for spot-checking.")

    # 6 Scenarios to test
    scenarios = [
        {
            "name": "Scenario 1: Weekday Morning Peak (Heavy traffic expected)",
            "route_id": routes[0]['id'],
            "route_name": routes[0]['name'],
            "departure_time": datetime(2026, 8, 25, 9, 0, 0, tzinfo=timezone.utc),
            "path_variant": None
        },
        {
            "name": "Scenario 2: Weekday Night (Free-flow expected)",
            "route_id": routes[0]['id'],
            "route_name": routes[0]['name'],
            "departure_time": datetime(2026, 8, 25, 23, 30, 0, tzinfo=timezone.utc),
            "path_variant": None
        },
        {
            "name": "Scenario 3: Weekday Evening Peak (Hectic commute expected)",
            "route_id": routes[1]['id'] if len(routes) > 1 else routes[0]['id'],
            "route_name": routes[1]['name'] if len(routes) > 1 else routes[0]['name'],
            "departure_time": datetime(2026, 8, 24, 18, 30, 0, tzinfo=timezone.utc),
            "path_variant": None
        },
        {
            "name": "Scenario 4: Sunday Late-Morning (Weekend pattern expected)",
            "route_id": routes[1]['id'] if len(routes) > 1 else routes[0]['id'],
            "route_name": routes[1]['name'] if len(routes) > 1 else routes[0]['name'],
            "departure_time": datetime(2026, 8, 23, 11, 0, 0, tzinfo=timezone.utc),
            "path_variant": None
        },
        {
            "name": "Scenario 5: Weekday Mid-Afternoon (Moderate traffic expected)",
            "route_id": routes[2]['id'] if len(routes) > 2 else routes[0]['id'],
            "route_name": routes[2]['name'] if len(routes) > 2 else routes[0]['name'],
            "departure_time": datetime(2026, 8, 25, 15, 0, 0, tzinfo=timezone.utc),
            "path_variant": None
        },
        {
            "name": "Scenario 6: Holiday Morning (August 15 Independence Day)",
            "route_id": routes[2]['id'] if len(routes) > 2 else routes[0]['id'],
            "route_name": routes[2]['name'] if len(routes) > 2 else routes[0]['name'],
            "departure_time": datetime(2026, 8, 15, 8, 30, 0, tzinfo=timezone.utc),
            "path_variant": None
        }
    ]

    print("\n" + "="*95)
    print("  RUNNING EXPLAIN_PREDICTION SPOT CHECKS (RETRAINED SPLIT MODEL)")
    print("="*95)

    for idx, case in enumerate(scenarios):
        print(f"\n{case['name']}")
        print(f"  Route Corridor:  {case['route_name']}")
        print(f"  Departure Time:  {case['departure_time']}")

        try:
            explanation = explain_prediction(
                route_id=case['route_id'],
                departure_time=case['departure_time'],
                path_variant=case['path_variant'],
                supabase_client=supabase,
                route_name=case['route_name']
            )

            prediction = explanation["predicted_delay_min"]
            base_value = explanation["base_value_min"]
            factors = explanation["factors"]

            print(f"  Predicted Delay: {prediction:.2f} mins (Base default: {base_value:.2f} mins)")
            
            # Print top 3 factors
            print("  Top 3 Contributing Factors:")
            for f_idx, f in enumerate(factors[:3]):
                print(f"    {f_idx+1}. {f['name']:<28} | Value: {f['value']:<25} | Attribution: {f['shap_value_min']:+.4f} mins")

        except Exception as e:
            print(f"  [ERROR] explain_prediction failed: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "="*95)

if __name__ == '__main__':
    main()
