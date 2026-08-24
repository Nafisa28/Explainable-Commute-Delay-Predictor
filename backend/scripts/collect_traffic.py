# =============================================================================
# collect_traffic.py - Traffic-Aware Travel Time Collection
# =============================================================================
# DATA SOURCE: TomTom Routing API (with traffic=true)
#
# WHY NOT OSRM?  The public OSRM instance (router.project-osrm.org) returns
# static, non-traffic-aware travel-time estimates.  Over 52 collections across
# nearly 2 days — including actual peak hours — every query for the same route
# returned exactly 23.878333… minutes.  OSRM's default car profile does not
# incorporate live or historical traffic data, so delay_min would never show
# any variance regardless of collection duration.
#
# TomTom's Routing API with the traffic flag enabled incorporates real-time and
# historical traffic flow data, producing travel-time estimates that genuinely
# vary by time of day — which is exactly what the delay-prediction model needs.
# =============================================================================

import os
import sys
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# Ensure scripts directory can import other modules, and setup dotenv path
current_dir = os.path.dirname(os.path.abspath(__file__))
env_paths = [
    os.path.join(current_dir, '..', '.env'),
    os.path.join(current_dir, '..', '..', '.env'),
    os.path.join(current_dir, '.env')
]

loaded = False
for path in env_paths:
    if os.path.exists(path):
        load_dotenv(dotenv_path=path)
        loaded = True
        break
if not loaded:
    load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
tomtom_api_key = os.environ.get("TOMTOM_API_KEY")

TOMTOM_BASE_URL = "https://api.tomtom.com/routing/1/calculateRoute"


def _build_tomtom_url(origin, destination, waypoints):
    """Build the TomTom calculateRoute URL.

    TomTom expects coordinates as  lat,lng:lat,lng  (colon-separated points).
    Waypoints are placed between origin and destination in the path.
    """
    points = []
    points.append(f"{origin['lat']},{origin['lng']}")
    for wp in waypoints:
        points.append(f"{wp['lat']},{wp['lng']}")
    points.append(f"{destination['lat']},{destination['lng']}")

    coords_path = ":".join(points)
    url = f"{TOMTOM_BASE_URL}/{coords_path}/json"
    return url


def run_collection():
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in the environment.")
        return

    if not tomtom_api_key:
        print("Error: TOMTOM_API_KEY must be set in the environment.")
        return

    supabase: Client = create_client(supabase_url, supabase_key)

    print(f"[{datetime.now().isoformat()}] Fetching routes from database...")
    try:
        response = supabase.table('routes').select('*').execute()
        routes = response.data
    except Exception as e:
        print(f"Error fetching routes from database: {e}")
        return

    if not routes:
        print("No routes found in database. Please run seed_routes.py first.")
        return

    print(f"Found {len(routes)} routes. Resolving travel times via TomTom (traffic-aware)...")

    for route in routes:
        route_id = route['id']
        route_name = route['name']
        path_variants = route.get('path_variants')

        if not path_variants:
            print(f"Skipping route {route_name} - no path variants found.")
            continue

        for variant in path_variants:
            label = variant.get('label', 'Default')
            origin = variant.get('origin')
            destination = variant.get('destination')
            waypoints = variant.get('waypoints', [])

            if not origin or not destination:
                print(f"Skipping variant '{label}' of route '{route_name}' due to missing coordinates.")
                continue

            url = _build_tomtom_url(origin, destination, waypoints)
            params = {
                "key": tomtom_api_key,
                "traffic": "true",           # Enable real-time traffic
                "travelMode": "car",
            }

            print(f"Querying TomTom for '{route_name}' ({label})...")
            try:
                resp = requests.get(url, params=params, timeout=15)

                # Handle TomTom-specific HTTP errors
                if resp.status_code == 401:
                    print(f"  TomTom API key is invalid or expired (HTTP 401). Skipping.")
                    continue
                if resp.status_code == 403:
                    print(f"  TomTom API key lacks permissions (HTTP 403). Skipping.")
                    continue
                if resp.status_code == 429:
                    print(f"  TomTom rate limit exceeded (HTTP 429). Sleeping 60s then skipping.")
                    time.sleep(60)
                    continue

                resp.raise_for_status()
                data = resp.json()

                # TomTom returns routes[] with a summary containing the key fields
                tt_routes = data.get("routes")
                if not tt_routes or len(tt_routes) == 0:
                    print(f"  TomTom returned no routes for '{route_name}' ({label}). Skipping.")
                    continue

                summary = tt_routes[0].get("summary", {})
                travel_time_sec = summary.get("travelTimeInSeconds")
                distance_meters = summary.get("lengthInMeters")

                if travel_time_sec is None or distance_meters is None:
                    print(f"  TomTom response missing travelTimeInSeconds or lengthInMeters. Skipping.")
                    continue

                travel_time_min = travel_time_sec / 60.0
                distance_km = distance_meters / 1000.0

                log_entry = {
                    "route_id": route_id,
                    "path_variant": label,
                    "travel_time_min": travel_time_min,
                    "distance_km": distance_km,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                supabase.table('traffic_logs').insert(log_entry).execute()
                print(f"  Successfully logged: {travel_time_min:.2f} mins, {distance_km:.2f} km")

                # Polite delay between sequential external API queries
                time.sleep(1.0)

            except requests.exceptions.JSONDecodeError:
                print(f"  TomTom returned malformed JSON for '{route_name}' ({label}). Skipping.")
            except requests.exceptions.ConnectionError as e:
                print(f"  Connection error reaching TomTom for '{route_name}' ({label}): {e}")
            except requests.exceptions.Timeout:
                print(f"  TomTom request timed out for '{route_name}' ({label}). Skipping.")
            except Exception as e:
                print(f"  Failed to fetch/log traffic for '{route_name}' ({label}): {e}")


if __name__ == '__main__':
    run_collection()
