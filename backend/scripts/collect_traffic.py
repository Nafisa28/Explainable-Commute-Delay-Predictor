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
osrm_base_url = os.environ.get("OSRM_BASE_URL", "http://router.project-osrm.org").rstrip("/")

def run_collection():
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in the environment.")
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

    print(f"Found {len(routes)} routes. Resolving travel times via OSRM...")
    
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
                
            # Build coordinates string for OSRM: lon,lat
            coords = []
            coords.append(f"{origin['lng']},{origin['lat']}")
            for wp in waypoints:
                coords.append(f"{wp['lng']},{wp['lat']}")
            coords.append(f"{destination['lng']},{destination['lat']}")
            
            coords_str = ';'.join(coords)
            url = f"{osrm_base_url}/route/v1/driving/{coords_str}?overview=false"
            
            print(f"Querying OSRM for '{route_name}' ({label})...")
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                if data.get('code') != 'Ok':
                    print(f"OSRM returned error code {data.get('code')} for route '{route_name}' ({label}).")
                    continue
                    
                route_res = data['routes'][0]
                duration_sec = route_res['duration']
                distance_meters = route_res['distance']
                
                travel_time_min = duration_sec / 60.0
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
                
            except Exception as e:
                print(f"Failed to fetch/log traffic for '{route_name}' ({label}): {e}")

if __name__ == '__main__':
    run_collection()
