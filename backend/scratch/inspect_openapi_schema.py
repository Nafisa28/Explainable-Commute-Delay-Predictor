import os
import sys
import requests
from dotenv import load_dotenv
from supabase import create_client

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

supabase = create_client(url, key)

# Test creating a test user or checking auth
print("Testing supabase auth and table...")
try:
    # Check OpenAPI schema from PostgREST to see current columns of saved_routes
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    schema_resp = requests.get(f"{url}/rest/v1/", headers=headers)
    if schema_resp.status_code == 200:
        schema = schema_resp.json()
        definitions = schema.get("definitions", {})
        saved_routes_def = definitions.get("saved_routes", {})
        print("saved_routes properties in OpenAPI schema:")
        print(saved_routes_def.get("properties", {}).keys())
except Exception as e:
    print("Schema fetch error:", e)
