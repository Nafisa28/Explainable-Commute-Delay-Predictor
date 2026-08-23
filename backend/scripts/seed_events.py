import os
import sys
from datetime import date
from dotenv import load_dotenv
from supabase import create_client, Client

# Set up project path for package imports
current_dir = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(current_dir, '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load constants
from backend.features.constants import BENGALURU_HOLIDAYS_2026

# Setup dotenv path
env_paths = [
    os.path.join(current_dir, '..', '.env'),
    os.path.join(PROJECT_ROOT, '.env'),
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
supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in your environment configuration.")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(supabase_url, supabase_key)

# Hardcoded names matching the BENGALURU_HOLIDAYS_2026 set
HOLIDAY_NAMES = {
    date(2026, 1, 1): "New Year's Day",
    date(2026, 1, 26): "Republic Day",
    date(2026, 2, 15): "Maha Shivaratri",
    date(2026, 3, 19): "Ugadi (Telugu/Kannada New Year)",
    date(2026, 3, 20): "Eid al-Fitr",
    date(2026, 4, 3): "Good Friday",
    date(2026, 4, 14): "Ambedkar Jayanti",
    date(2026, 5, 1): "May Day / Labor Day",
    date(2026, 5, 27): "Bakrid / Eid al-Adha",
    date(2026, 8, 15): "Independence Day",
    date(2026, 9, 14): "Ganesh Chaturthi",
    date(2026, 9, 15): "Eid Milad",
    date(2026, 10, 2): "Gandhi Jayanti",
    date(2026, 10, 19): "Mahanavami / Ayudha Puja",
    date(2026, 10, 20): "Vijayadashami (Dasara)",
    date(2026, 11, 1): "Kannada Rajyotsava",
    date(2026, 11, 8): "Naraka Chaturdashi (Diwali)",
    date(2026, 11, 9): "Balipadyami Deepavali",
    date(2026, 11, 27): "Kanakadasa Jayanti",
    date(2026, 12, 25): "Christmas",
}

def seed_events():
    print("Fetching routes to associate with events...")
    try:
        response = supabase.table('routes').select('id').execute()
        routes = response.data
    except Exception as e:
        print(f"Error fetching routes: {e}")
        sys.exit(1)

    if not routes:
        print("Error: No routes found in database. Please run seed_routes.py first.")
        sys.exit(1)

    route_ids = [r['id'] for r in routes]
    print(f"Found {len(route_ids)} routes: {route_ids}")

    print("Cleaning existing events...")
    try:
        # Delete all events
        supabase.table('events').delete().neq('id', 0).execute()
        print("Existing events cleaned.")
    except Exception as e:
        print(f"Warning: Could not clean events table: {e}")

    print(f"Seeding {len(BENGALURU_HOLIDAYS_2026)} holiday events...")
    inserted_count = 0
    for h_date in sorted(BENGALURU_HOLIDAYS_2026):
        name = HOLIDAY_NAMES.get(h_date, "Bengaluru Festival/Holiday")
        event_entry = {
            "name": name,
            "date": h_date.isoformat(),
            "route_ids_affected": route_ids,
            "event_type": "Festival",
            "distance_to_route_km": 0.0
        }
        
        try:
            supabase.table('events').insert(event_entry).execute()
            print(f"  Inserted: {h_date.isoformat()} - {name}")
            inserted_count += 1
        except Exception as e:
            print(f"  Failed to insert {h_date.isoformat()} - {name}: {e}")

    print(f"\nSuccessfully seeded {inserted_count} events into the database.")

if __name__ == '__main__':
    seed_events()
