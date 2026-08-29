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

row = {
    "user_id": "af41aa55-ce49-44b5-9ac5-a573b86148d8",
    "origin_name": "Whitefield",
    "origin_lat": 12.9698,
    "origin_lng": 77.7499,
    "dest_name": "MG Road",
    "dest_lat": 12.9756,
    "dest_lng": 77.6068,
    "nickname": "Daily Office Commute"
}

try:
    res = supabase.table('saved_routes').insert(row).execute()
    print("Insert success:", res.data)
except Exception as e:
    print("Insert result/error:", e)
