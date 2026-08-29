import os
import sys
import json
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
api_key = os.environ.get("TOMTOM_API_KEY")

locations = "12.8399,77.677:12.9352,77.6244"
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
routes = data.get("routes", [])

for i, r in enumerate(routes):
    summary = r.get("summary", {})
    guidance = r.get("guidance", {})
    instructions = guidance.get("instructions", [])
    print(f"\n==================== ROUTE {i+1} ====================")
    print(f"Length: {summary.get('lengthInMeters')} m | Live Time: {summary.get('travelTimeInSeconds')/60.0:.1f}m | Free-Flow: {summary.get('noTrafficTravelTimeInSeconds')/60.0:.1f}m")
    if "deviationDistance" in summary:
        print(f"Deviation Distance: {summary.get('deviationDistance')}m at point {summary.get('deviationPoint')}")
    print("Turn-by-turn steps:")
    for idx, inst in enumerate(instructions):
        print(f"  {idx+1}. [{inst.get('routeOffsetInMeters')}m] {inst.get('message')} (street: '{inst.get('street')}', roadNumbers: {inst.get('roadNumbers')})")
