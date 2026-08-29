"""
Test Script for SHAP Explainer V2

Calls explain_prediction_v2() for real Bengaluru coordinate pairs using
live TomTom data and prints the full structured explanation including
SHAP factor attributions.
"""

import os
import sys
import json
from datetime import datetime, timezone

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client
from backend.explainability.shap_explainer_v2 import explain_prediction_v2


def main():
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set.")
        sys.exit(1)
    supabase = create_client(url, key)

    # Real Bengaluru coordinate pairs (from seed_routes.py)
    test_cases = [
        {
            "name": "Whitefield to MG Road",
            "origin_lat": 12.9698, "origin_lng": 77.7499,
            "dest_lat": 12.9756,   "dest_lng": 77.6068,
        },
        {
            "name": "Electronic City to Silk Board",
            "origin_lat": 12.8452, "origin_lng": 77.6602,
            "dest_lat": 12.9176,   "dest_lng": 77.6244,
        },
        {
            "name": "Koramangala to Indiranagar",
            "origin_lat": 12.9352, "origin_lng": 77.6244,
            "dest_lat": 12.9719,   "dest_lng": 77.6412,
        },
    ]

    dep_time = datetime.now(timezone.utc)

    print("=" * 80)
    print("  SHAP EXPLAINER V2 -- LIVE TEST")
    print(f"  Departure time: {dep_time.isoformat()}")
    print("=" * 80)

    for case in test_cases:
        print(f"\n--- Route: {case['name']}")
        print(f"    Origin:      ({case['origin_lat']}, {case['origin_lng']})")
        print(f"    Destination: ({case['dest_lat']}, {case['dest_lng']})")

        try:
            result = explain_prediction_v2(
                origin_lat=case['origin_lat'],
                origin_lng=case['origin_lng'],
                dest_lat=case['dest_lat'],
                dest_lng=case['dest_lng'],
                departure_time=dep_time,
                route_name=case['name'],
                supabase_client=supabase,
            )

            print(f"\n    Predicted Delay: {result['predicted_delay_min']:.4f} min")
            print(f"    Base Value:      {result['base_value_min']:.4f} min")
            print(f"\n    Factors ({len(result['factors'])}):")

            has_nonzero = False
            has_congestion = False
            for f in result['factors']:
                marker = "*" if abs(f['shap_value_min']) > 0.001 else " "
                if abs(f['shap_value_min']) > 0.001:
                    has_nonzero = True
                if f['category'] == 'live_traffic':
                    has_congestion = True
                print(
                    f"      {marker} [{f['category']:14s}] {f['name']:25s}"
                    f"  value={str(f['value']):>12s}"
                    f"  SHAP={f['shap_value_min']:+.4f} min"
                )

            # Verification checks
            factors_sum = sum(f['shap_value_min'] for f in result['factors'])
            additivity_ok = abs(
                result['base_value_min'] + factors_sum - result['predicted_delay_min']
            ) < 0.01

            print(f"\n    [CHECK] Has non-zero SHAP factors:      {'[OK]' if has_nonzero else '[FAIL]'}")
            print(f"    [CHECK] Has congestion_ratio factor:     {'[OK]' if has_congestion else '[FAIL]'}")
            print(f"    [CHECK] SHAP additivity holds:           {'[OK]' if additivity_ok else '[FAIL]'}")

        except Exception as e:
            print(f"    [ERROR] {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 80)
    print("  ALL TESTS COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    main()
