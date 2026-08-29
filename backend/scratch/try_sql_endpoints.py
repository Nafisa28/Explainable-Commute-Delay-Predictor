import os
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

sql = """
ALTER TABLE saved_routes
    DROP CONSTRAINT IF EXISTS saved_routes_route_id_fkey;

ALTER TABLE saved_routes
    DROP COLUMN IF EXISTS route_id;

ALTER TABLE saved_routes
    ADD COLUMN IF NOT EXISTS origin_name TEXT NOT NULL DEFAULT 'Origin',
    ADD COLUMN IF NOT EXISTS origin_lat NUMERIC NOT NULL DEFAULT 12.9716,
    ADD COLUMN IF NOT EXISTS origin_lng NUMERIC NOT NULL DEFAULT 77.5946,
    ADD COLUMN IF NOT EXISTS dest_name TEXT NOT NULL DEFAULT 'Destination',
    ADD COLUMN IF NOT EXISTS dest_lat NUMERIC NOT NULL DEFAULT 12.9716,
    ADD COLUMN IF NOT EXISTS dest_lng NUMERIC NOT NULL DEFAULT 77.5946;

ALTER TABLE saved_routes
    ALTER COLUMN origin_name DROP DEFAULT,
    ALTER COLUMN origin_lat DROP DEFAULT,
    ALTER COLUMN origin_lng DROP DEFAULT,
    ALTER COLUMN dest_name DROP DEFAULT,
    ALTER COLUMN dest_lat DROP DEFAULT,
    ALTER COLUMN dest_lng DROP DEFAULT;
"""

# Try various management endpoints
endpoints = [
    f"https://api.supabase.com/v1/projects/yocjtnxotlypmtzpbjlt/database/query",
    f"https://api.supabase.com/v1/projects/yocjtnxotlypmtzpbjlt/sql",
    f"{url}/database/query",
    f"{url}/sql"
]

for ep in endpoints:
    try:
        r = requests.post(ep, headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"}, json={"query": sql, "sql": sql})
        print(f"{ep} -> {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"{ep} error: {e}")
