import os
import sys
import json
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
api_key = os.environ.get("TOMTOM_API_KEY")

origin_lat, origin_lng = 12.9698, 77.7499
dest_lat, dest_lng = 12.9756, 77.6068

locations = f"{origin_lat},{origin_lng}:{dest_lat},{dest_lng}"
url = f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json"

params = {
    "key": api_key,
    "traffic": "true",
    "departAt": "now",
    "computeTravelTimeFor": "all",
    "maxAlternatives": 2,
    "instructionsType": "text"
}

resp = requests.get(url, params=params)
data = resp.json()

for i, r in enumerate(data.get("routes", [])):
    guidance = r.get("guidance", {})
    instructions = guidance.get("instructions", [])
    print(f"\n--- Route {i+1} ---")
    print(f"Num instructions: {len(instructions)}")
    # Find significant road names
    road_names = set()
    for inst in instructions:
        msg = inst.get("message", "")
        street = inst.get("street", "")
        if street:
            road_names.add(street)
    print(f"Streets: {list(road_names)[:5]}")
