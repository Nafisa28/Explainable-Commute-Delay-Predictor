import os
import sys
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

# Try Supabase SQL REST endpoint if enabled
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

# 1. Try pg sql endpoint
resp = requests.post(f"{url}/rest/v1/rpc/exec_sql", headers=headers, json={"sql": sql})
print(f"rpc/exec_sql status: {resp.status_code}, text: {resp.text}")

# 2. Check if pgsql endpoint
resp2 = requests.post(f"{url}/pg/query", headers=headers, json={"query": sql})
print(f"pg/query status: {resp2.status_code}, text: {resp2.text}")
