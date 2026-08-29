import os
import sys
from dotenv import load_dotenv
from supabase import create_client

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"Supabase URL: {url}")
print(f"Key exists: {bool(key)}")

db_url = os.environ.get("DATABASE_URL")
print(f"DATABASE_URL exists: {bool(db_url)}")

supabase = create_client(url, key)
try:
    res = supabase.table('saved_routes').select('*').limit(1).execute()
    print("saved_routes query successful:", res.data)
except Exception as e:
    print("saved_routes query error:", e)
