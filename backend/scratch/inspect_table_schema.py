import os
import sys
from dotenv import load_dotenv
from supabase import create_client

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# Let's inspect saved_routes
try:
    res = supabase.table('saved_routes').select('*').limit(5).execute()
    print("Columns in data:", res.data)
except Exception as e:
    print("Error:", e)
