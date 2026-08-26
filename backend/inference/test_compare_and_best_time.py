"""
Test Script - compare_path_variants() and find_best_departure_time()

Runs both functions against real Supabase routes and prints structured
results so the outputs can be manually inspected for correctness:
  * Are options sorted by delay ascending (best first)?
  * Does best-time actually show savings vs. the current time?
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

from backend.inference.compare_routes import compare_path_variants
from backend.inference.best_time import find_best_departure_time


def pp(obj: dict) -> str:
    """Pretty-print a dict as indented JSON."""
    return json.dumps(obj, indent=2, default=str)


def main():
    # -- Initialise Supabase --
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in env.")
        sys.exit(1)

    supabase: Client = create_client(url, key)

    # -- Fetch routes --
    routes_res = supabase.table('routes').select('*').limit(3).execute()
    if not routes_res.data:
        print("No routes found in Supabase. Seed the routes table first.")
        sys.exit(1)

    routes = routes_res.data
    print(f"Loaded {len(routes)} routes for testing.\n")

    # ==============================================================================
    # TEST 1 - compare_path_variants
    # ==============================================================================
    print("=" * 80)
    print("  TEST 1: compare_path_variants()")
    print("=" * 80)

    test_times = [
        ("Morning peak (09:00 UTC)", datetime(2026, 8, 25, 9, 0, 0, tzinfo=timezone.utc)),
        ("Night off-peak (23:30 UTC)", datetime(2026, 8, 25, 23, 30, 0, tzinfo=timezone.utc)),
    ]

    for route in routes[:2]:
        route_id = route['id']
        route_name = route['name']
        pv_list = route.get('path_variants', [])
        n_variants = len(pv_list)

        for time_label, dep_time in test_times:
            print(f"\n--- Route: {route_name}")
            print(f"   Variants: {n_variants} | Departure: {time_label}")

            try:
                result = compare_path_variants(
                    route_id=route_id,
                    departure_time=dep_time,
                    supabase_client=supabase,
                )

                # Verify sorting
                delays = [o['predicted_delay_min'] for o in result['options']]
                is_sorted = all(delays[i] <= delays[i + 1] for i in range(len(delays) - 1))

                print(f"   Options ({len(result['options'])} variants):")
                for i, opt in enumerate(result['options']):
                    marker = "* BEST" if i == 0 else f"  #{i + 1}"
                    tf = opt['top_factor']
                    print(
                        f"     {marker}  {opt['path_variant']}"
                        f"  ->  {opt['predicted_delay_min']:.2f} min"
                        f"  (top factor: {tf['name']} = {tf['value']}"
                        f", SHAP {tf['shap_value_min']:+.4f} min)"
                    )

                print(f"   [CHECK] Sorted ascending: {'[OK]' if is_sorted else '[FAIL]'}")

            except Exception as e:
                print(f"   [ERROR] {e}")
                import traceback
                traceback.print_exc()

    # ==============================================================================
    # TEST 2 - find_best_departure_time
    # ==============================================================================
    print("\n" + "=" * 80)
    print("  TEST 2: find_best_departure_time()")
    print("=" * 80)

    # Pick first route, first variant, at morning peak - the function should
    # find a time with lower delay within the next 2.5 hours.
    for route in routes[:2]:
        route_id = route['id']
        route_name = route['name']
        pv_list = route.get('path_variants', [])
        if not pv_list:
            print(f"\n--- Route: {route_name}  - skipped (no variants)")
            continue

        first_variant = pv_list[0]['label'] if isinstance(pv_list[0], dict) else pv_list[0]
        dep_time = datetime(2026, 8, 25, 6, 0, 0, tzinfo=timezone.utc)

        print(f"\n--- Route: {route_name}")
        print(f"   Variant: {first_variant}")
        print(f"   Current departure: {dep_time.isoformat()}")

        try:
            result = find_best_departure_time(
                route_id=route_id,
                path_variant=first_variant,
                current_departure_time=dep_time,
                supabase_client=supabase,
                window_hours=2.5,
                step_minutes=30,  # 30-min steps to keep test runtime manageable
            )

            print(f"\n   Current delay:      {result['current_predicted_delay_min']:.2f} min")
            print(f"   Best departure:     {result['recommended_departure_time']}")
            print(f"   Best delay:         {result['predicted_delay_min']:.2f} min")
            print(f"   Savings:            {result['savings_min']:.2f} min")

            savings_ok = result['savings_min'] >= 0
            best_le_current = result['predicted_delay_min'] <= result['current_predicted_delay_min']
            print(f"   [CHECK] Savings >= 0:               {'[OK]' if savings_ok else '[FAIL]'}")
            print(f"   [CHECK] Best <= current delay:      {'[OK]' if best_le_current else '[FAIL]'}")

        except Exception as e:
            print(f"   [ERROR] {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 80)
    print("  ALL TESTS COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    main()
