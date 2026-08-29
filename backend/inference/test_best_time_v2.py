"""
Test Script for Best Departure Time Optimization (Model V2)

Evaluates find_best_departure_time_v2() and the Flask GET /predict/best-time-v2 endpoint
across 3 real Bengaluru coordinate pairs during peak travel hours to verify that the
recommended time delivers sensible travel-time savings.
"""

import os
import sys
from datetime import datetime, timezone, timedelta

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.inference.best_time_v2 import find_best_departure_time_v2
from backend.api.app import app


def run_tests():
    # Test during a weekday morning peak hour: 8:45 AM IST (03:15 AM UTC) on Monday
    peak_departure = datetime(2026, 8, 31, 3, 15, 0, tzinfo=timezone.utc)

    test_cases = [
        {
            "name": "Whitefield to MG Road",
            "origin": (12.9698, 77.7499),
            "dest": (12.9756, 77.6068),
            "origin_name": "Whitefield",
            "dest_name": "MG Road",
        },
        {
            "name": "Electronic City to Koramangala",
            "origin": (12.8399, 77.6770),
            "dest": (12.9352, 77.6244),
            "origin_name": "Electronic City",
            "dest_name": "Koramangala",
        },
        {
            "name": "Hebbal to Indiranagar",
            "origin": (13.0358, 77.5970),
            "dest": (12.9784, 77.6408),
            "origin_name": "Hebbal",
            "dest_name": "Indiranagar",
        },
    ]

    print("=" * 80)
    print("TESTING MODEL V2 BEST DEPARTURE TIME OPTIMIZATION")
    print(f"Simulated Initial Departure (Morning Peak): {peak_departure.isoformat()}")
    print("=" * 80)

    # 1. Test Python Core Function find_best_departure_time_v2
    for tc in test_cases:
        name = tc["name"]
        o_lat, o_lng = tc["origin"]
        d_lat, d_lng = tc["dest"]
        o_name = tc["origin_name"]
        d_name = tc["dest_name"]

        print(f"\nCorridor: {name}")
        print(f"Coordinates: ({o_lat}, {o_lng}) -> ({d_lat}, {d_lng})")
        print("-" * 80)

        result = find_best_departure_time_v2(
            origin_lat=o_lat,
            origin_lng=o_lng,
            dest_lat=d_lat,
            dest_lng=d_lng,
            current_departure_time=peak_departure,
            origin_name=o_name,
            dest_name=d_name,
            window_hours=2.5,
            step_minutes=15,
        )

        curr_time_dt = datetime.fromisoformat(result["current_departure_time"])
        rec_time_dt = datetime.fromisoformat(result["recommended_departure_time"])

        print(f"  Origin / Destination: {result['origin_name']} -> {result['dest_name']}")
        print(f"  Distance: {result['distance_km']} km | Free-flow baseline: {result['free_flow_travel_time_min']} min")
        print(f"  Current Departure Time    : {curr_time_dt.strftime('%I:%M %p UTC')} -> Live travel time: {result['current_live_travel_time_min']} min")
        print(f"  Recommended Departure Time: {rec_time_dt.strftime('%I:%M %p UTC')} -> Est travel time : {result['recommended_live_travel_time_min']} min")
        print(f"  Potential Time Savings    : {result['savings_min']} min")
        print(f"  Timeline Steps Evaluated  : {len(result['timeline'])} steps")

        # Assertions
        assert result["current_live_travel_time_min"] > 0, "Current live travel time must be positive"
        assert result["recommended_live_travel_time_min"] > 0, "Recommended travel time must be positive"
        assert result["savings_min"] >= 0, "Savings must be non-negative"
        assert result["recommended_live_travel_time_min"] <= result["current_live_travel_time_min"], \
            "Recommended travel time cannot exceed current travel time"
        assert len(result["timeline"]) >= 5, "Timeline must contain multiple candidate evaluations"

        print(f"  [OK] Core function validated for {name}")

    # 2. Test Flask GET /predict/best-time-v2 endpoint
    print("\n" + "=" * 80)
    print("TESTING FLASK GET /predict/best-time-v2 ENDPOINT")
    print("=" * 80)

    client = app.test_client()
    query_params = {
        "origin_lat": 12.9698,
        "origin_lng": 77.7499,
        "dest_lat": 12.9756,
        "dest_lng": 77.6068,
        "origin_name": "Whitefield",
        "dest_name": "MG Road",
        "departure_time": peak_departure.isoformat(),
        "window_hours": 2.5,
        "step_minutes": 15,
    }

    resp = client.get("/predict/best-time-v2", query_string=query_params)
    print(f"  GET /predict/best-time-v2 status: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
    
    json_data = resp.get_json()
    assert "recommended_departure_time" in json_data
    assert "savings_min" in json_data
    assert "timeline" in json_data
    print(f"  Response Savings: {json_data['savings_min']} min, Best Departure: {json_data['recommended_departure_time']}")
    print("  [OK] Flask endpoint GET /predict/best-time-v2 verified")

    print("\n" + "=" * 80)
    print("ALL BEST TIME OPTIMIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
