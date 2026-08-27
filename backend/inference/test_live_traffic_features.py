"""
Test Script for Live Traffic Features Module

Calls get_live_traffic_features() for real Bengaluru coordinate pairs
and prints the results to verify correctness.
"""

import os
import sys

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.inference.live_traffic_features import get_live_traffic_features, TomTomAPIError

def main():
    # Coordinates from seed_routes.py for testing
    test_cases = [
        {
            "name": "Whitefield to MG Road",
            "origin_lat": 12.9698,
            "origin_lng": 77.7499,
            "dest_lat": 12.9756,
            "dest_lng": 77.6068
        },
        {
            "name": "Electronic City to Silk Board",
            "origin_lat": 12.8452,
            "origin_lng": 77.6602,
            "dest_lat": 12.9176,
            "dest_lng": 77.6244
        },
        {
            "name": "Koramangala to Indiranagar",
            "origin_lat": 12.9352,
            "origin_lng": 77.6244,
            "dest_lat": 12.9719,
            "dest_lng": 77.6412
        }
    ]

    print("=" * 80)
    print("  RUNNING TOMTOM LIVE TRAFFIC FEATURES TEST")
    print("=" * 80)

    for case in test_cases:
        print(f"\nEvaluating Route: {case['name']}")
        print(f"  Origin:      ({case['origin_lat']}, {case['origin_lng']})")
        print(f"  Destination: ({case['dest_lat']}, {case['dest_lng']})")

        try:
            features = get_live_traffic_features(
                origin_lat=case['origin_lat'],
                origin_lng=case['origin_lng'],
                dest_lat=case['dest_lat'],
                dest_lng=case['dest_lng']
            )

            print("  --- Query Results ---")
            print(f"  Congestion Ratio:            {features['congestion_ratio']:.4f}")
            print(f"  Live Travel Time (min):      {features['live_travel_time_min']:.2f}")
            print(f"  Free-flow Travel Time (min): {features['free_flow_travel_time_min']:.2f}")
            print(f"  Distance (km):               {features['distance_km']:.2f}")

            # Basic checks
            ratio = features['congestion_ratio']
            print(f"  [CHECK] Congestion Ratio >= 0.95: {'[OK]' if ratio >= 0.95 else '[FAIL]'}")
            print(f"  [CHECK] Distance > 0:            {'[OK]' if features['distance_km'] > 0 else '[FAIL]'}")

        except TomTomAPIError as e:
            print(f"  [API ERROR] Failed to query TomTom: {e}")
        except Exception as e:
            print(f"  [UNEXPECTED ERROR] {e}")

    print("\n" + "=" * 80)
    print("  ALL TESTS COMPLETE")
    print("=" * 80)

if __name__ == '__main__':
    main()
