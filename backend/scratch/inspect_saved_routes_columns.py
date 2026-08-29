import os
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

headers = {"apikey": key, "Authorization": f"Bearer {key}"}
res = requests.get(f"{url}/rest/v1/saved_routes?limit=1", headers=headers)
print("saved_routes GET status:", res.status_code)
print("saved_routes GET body:", res.text)
