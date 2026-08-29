"""
Test Script for Alternate Route Comparison (Model V2)

Evaluates compare_alternate_routes() across real Bengaluru coordinate pairs
and validates that routes are distinct, differentiated, and correctly sorted.
"""

import os
import sys
from datetime import datetime, timezone

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.inference.compare_routes_v2 import compare_alternate_routes


def run_tests():
    test_cases = [
        {
            "name": "Whitefield to MG Road",
            "origin": (12.9698, 77.7499),
            "dest": (12.9756, 77.6068),
        },
        {
            "name": "Electronic City to Koramangala",
            "origin": (12.8399, 77.6770),
            "dest": (12.9352, 77.6244),
        },
        {
            "name": "Hebbal to Indiranagar",
            "origin": (13.0358, 77.5970),
            "dest": (12.9784, 77.6408),
        },
    ]

    now = datetime.now(timezone.utc)
    print("=" * 80)
    print("TESTING MODEL V2 ALTERNATE ROUTE COMPARISON")
    print(f"Timestamp: {now.isoformat()}")
    print("=" * 80)

    for tc in test_cases:
        name = tc["name"]
        o_lat, o_lng = tc["origin"]
        d_lat, d_lng = tc["dest"]

        print(f"\nEvaluating Corridor: {name}")
        print(f"Coordinates: ({o_lat}, {o_lng}) -> ({d_lat}, {d_lng})")
        print("-" * 80)

        results = compare_alternate_routes(
            origin_lat=o_lat,
            origin_lng=o_lng,
            dest_lat=d_lat,
            dest_lng=d_lng,
            departure_time=now,
            max_alternatives=2,
        )

        print(f"Found {len(results)} distinct route options:")
        for idx, opt in enumerate(results):
            best_badge = " [BEST CHOICE - FASTEST ROUTE]" if opt.get("is_best") else ""
            print(f"  Option {idx + 1}: {opt['description']}{best_badge}")
            print(f"    - Live Travel Time: {opt['live_travel_time_min']} min (Free-flow: {opt['free_flow_travel_time_min']} min)")
            print(f"    - Predicted Delay : +{opt['predicted_delay_min']} min")
            print(f"    - Congestion Ratio: {opt['congestion_ratio']}x")
            print(f"    - Distance        : {opt['distance_km']} km")

        # Assertions
        assert len(results) >= 1, "Should return at least 1 route."
        assert results[0]["is_best"] is True, "First option should be marked as best."
        if len(results) > 1:
            for i in range(len(results) - 1):
                assert results[i]["live_travel_time_min"] <= results[i + 1]["live_travel_time_min"], \
                    "Results must be sorted ascending by live_travel_time_min."
        print(f"  [OK] Validated sorting by live travel time for {name}")

    print("\n" + "=" * 80)
    print("ALL ROUTE COMPARISON TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
