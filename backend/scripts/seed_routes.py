import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Ensure scripts directory can import other modules if needed, and setup dotenv path
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
        print(f"Loaded environment variables from: {path}")
        break

if not loaded:
    load_dotenv()
    print("Loaded environment variables from default environment")

supabase_url = os.environ.get("SUPABASE_URL")
# Supabase key can be SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY
supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in your environment configuration.")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

# 8 Bengaluru routes with 2-3 path variants each
routes_data = [
    {
        "name": "Whitefield to MG Road",
        "origin": "Whitefield",
        "destination": "MG Road",
        "path_variants": [
            {
                "label": "via Old Airport Road",
                "origin": {"lat": 12.9698, "lng": 77.7499},
                "destination": {"lat": 12.9756, "lng": 77.6068},
                "waypoints": [{"lat": 12.9590, "lng": 77.6534}]
            },
            {
                "label": "via ITPL Main Rd and Whitefield Main Rd",
                "origin": {"lat": 12.9698, "lng": 77.7499},
                "destination": {"lat": 12.9756, "lng": 77.6068},
                "waypoints": [{"lat": 12.9904, "lng": 77.7288}]
            }
        ]
    },
    {
        "name": "Electronic City to Silk Board",
        "origin": "Electronic City",
        "destination": "Silk Board",
        "path_variants": [
            {
                "label": "via Hosur Road",
                "origin": {"lat": 12.8452, "lng": 77.6602},
                "destination": {"lat": 12.9176, "lng": 77.6244},
                "waypoints": []
            },
            {
                "label": "via NICE Ring Road and Bannerghatta Road",
                "origin": {"lat": 12.8452, "lng": 77.6602},
                "destination": {"lat": 12.9176, "lng": 77.6244},
                "waypoints": [{"lat": 12.8684, "lng": 77.6111}]
            }
        ]
    },
    {
        "name": "Koramangala to Indiranagar",
        "origin": "Koramangala",
        "destination": "Indiranagar",
        "path_variants": [
            {
                "label": "via 100 Feet Road",
                "origin": {"lat": 12.9352, "lng": 77.6244},
                "destination": {"lat": 12.9719, "lng": 77.6412},
                "waypoints": [{"lat": 12.9550, "lng": 77.6400}]
            },
            {
                "label": "via Inner Ring Road",
                "origin": {"lat": 12.9352, "lng": 77.6244},
                "destination": {"lat": 12.9719, "lng": 77.6412},
                "waypoints": [{"lat": 12.9420, "lng": 77.6320}]
            }
        ]
    },
    {
        "name": "HSR Layout to Marathahalli",
        "origin": "HSR Layout",
        "destination": "Marathahalli",
        "path_variants": [
            {
                "label": "via Outer Ring Road",
                "origin": {"lat": 12.9141, "lng": 77.6411},
                "destination": {"lat": 12.9591, "lng": 77.6974},
                "waypoints": [{"lat": 12.9300, "lng": 77.6780}]
            },
            {
                "label": "via Harlur and Kasavanahalli",
                "origin": {"lat": 12.9141, "lng": 77.6411},
                "destination": {"lat": 12.9591, "lng": 77.6974},
                "waypoints": [{"lat": 12.9050, "lng": 77.6700}]
            }
        ]
    },
    {
        "name": "Jayanagar to Majestic",
        "origin": "Jayanagar",
        "destination": "Majestic",
        "path_variants": [
            {
                "label": "via Lalbagh Fort Road",
                "origin": {"lat": 12.9307, "lng": 77.5832},
                "destination": {"lat": 12.9779, "lng": 77.5724},
                "waypoints": [{"lat": 12.9520, "lng": 77.5800}]
            },
            {
                "label": "via Kanakapura Road and KSRTC",
                "origin": {"lat": 12.9307, "lng": 77.5832},
                "destination": {"lat": 12.9779, "lng": 77.5724},
                "waypoints": [{"lat": 12.9450, "lng": 77.5700}]
            }
        ]
    },
    {
        "name": "Yeshwantpur to Hebbal",
        "origin": "Yeshwantpur",
        "destination": "Hebbal",
        "path_variants": [
            {
                "label": "via Outer Ring Road",
                "origin": {"lat": 13.0235, "lng": 77.5583},
                "destination": {"lat": 13.0359, "lng": 77.5978},
                "waypoints": [{"lat": 13.0400, "lng": 77.5750}]
            },
            {
                "label": "via CV Raman Road and Bellary Road",
                "origin": {"lat": 13.0235, "lng": 77.5583},
                "destination": {"lat": 13.0359, "lng": 77.5978},
                "waypoints": [{"lat": 13.0150, "lng": 77.5850}]
            }
        ]
    },
    {
        "name": "BTM Layout to Bannerghatta Road Junction",
        "origin": "BTM Layout",
        "destination": "Bannerghatta Road Junction",
        "path_variants": [
            {
                "label": "via Tavarekere Main Road",
                "origin": {"lat": 12.9166, "lng": 77.6101},
                "destination": {"lat": 12.9216, "lng": 77.5985},
                "waypoints": [{"lat": 12.9230, "lng": 77.6080}]
            },
            {
                "label": "via Outer Ring Road",
                "origin": {"lat": 12.9166, "lng": 77.6101},
                "destination": {"lat": 12.9216, "lng": 77.5985},
                "waypoints": [{"lat": 12.9180, "lng": 77.6020}]
            }
        ]
    },
    {
        "name": "Rajajinagar to Malleswaram",
        "origin": "Rajajinagar",
        "destination": "Malleswaram",
        "path_variants": [
            {
                "label": "via 10th Cross Road",
                "origin": {"lat": 12.9880, "lng": 77.5540},
                "destination": {"lat": 13.0031, "lng": 77.5696},
                "waypoints": [{"lat": 12.9950, "lng": 77.5620}]
            },
            {
                "label": "via Dr. Rajkumar Road",
                "origin": {"lat": 12.9880, "lng": 77.5540},
                "destination": {"lat": 13.0031, "lng": 77.5696},
                "waypoints": [{"lat": 12.9900, "lng": 77.5580}]
            }
        ]
    }
]

def seed_routes():
    print("Clearing existing routes...")
    try:
        # Delete filter requires matching all rows
        supabase.table('routes').delete().neq('name', '').execute()
        print("Existing routes cleared.")
    except Exception as e:
        print(f"Warning during routes cleanup: {e}")

    print(f"Seeding {len(routes_data)} routes into the 'routes' table...")
    try:
        response = supabase.table('routes').insert(routes_data).execute()
        print("Routes successfully seeded:")
        for idx, row in enumerate(response.data):
            print(f" {idx+1}. Seeded Route: {row['name']} (ID: {row['id']})")
    except Exception as e:
        print(f"Error seeding routes: {e}")
        sys.exit(1)

if __name__ == '__main__':
    seed_routes()
