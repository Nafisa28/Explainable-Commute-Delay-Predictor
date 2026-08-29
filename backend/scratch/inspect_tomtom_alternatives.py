import os
import sys
import json
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
api_key = os.environ.get("TOMTOM_API_KEY")

# Whitefield to MG Road
origin_lat, origin_lng = 12.9698, 77.7499
dest_lat, dest_lng = 12.9756, 77.6068

locations = f"{origin_lat},{origin_lng}:{dest_lat},{dest_lng}"
url = f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json"

params = {
    "key": api_key,
    "traffic": "true",
    "departAt": "now",
    "computeTravelTimeFor": "all",
    "maxAlternatives": 2
}

resp = requests.get(url, params=params)
data = resp.json()

print(f"Status: {resp.status_code}")
print(f"Num routes returned: {len(data.get('routes', []))}")

for i, r in enumerate(data.get("routes", [])):
    summary = r.get("summary", {})
    legs = r.get("legs", [])
    print(f"\n--- Route {i+1} ---")
    print(f"Length: {summary.get('lengthInMeters')} m")
    print(f"Travel time: {summary.get('travelTimeInSeconds')} s")
    print(f"No traffic time: {summary.get('noTrafficTravelTimeInSeconds')} s")
    print(f"Summary keys: {list(summary.keys())}")
    print(f"Route keys: {list(r.keys())}")
    if legs:
        print(f"Leg 0 summary: {legs[0].get('summary')}")
        print(f"Leg 0 keys: {list(legs[0].keys())}")
        if "points" in legs[0]:
            print(f"Points count: {len(legs[0]['points'])}")
