import os
import sys
import json
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
api_key = os.environ.get("TOMTOM_API_KEY")

def diagnose_corridor(name, origin, dest):
    o_lat, o_lng = origin
    d_lat, d_lng = dest
    locations = f"{o_lat},{o_lng}:{d_lat},{d_lng}"
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
    
    print("=" * 90)
    print(f"CORRIDOR: {name}")
    print(f"Num routes returned by TomTom: {len(routes)}")
    print("=" * 90)
    
    for i, r in enumerate(routes):
        summary = r.get("summary", {})
        guidance = r.get("guidance", {})
        instructions = guidance.get("instructions", [])
        legs = r.get("legs", [])
        points_count = len(legs[0].get("points", [])) if legs else 0
        
        print(f"\n--- ROUTE {i+1} ---")
        print(f"Length: {summary.get('lengthInMeters')} m ({summary.get('lengthInMeters')/1000.0:.2f} km)")
        print(f"Live Travel Time: {summary.get('travelTimeInSeconds')/60.0:.1f} min")
        print(f"No-Traffic (Free-Flow): {summary.get('noTrafficTravelTimeInSeconds')/60.0:.1f} min")
        print(f"Points in geometry: {points_count}")
        if "deviationDistance" in summary:
            print(f"Deviation Distance from primary: {summary.get('deviationDistance')} m, Deviation Time: {summary.get('deviationTime')} s")
            print(f"Deviation Point: {summary.get('deviationPoint')}")
            
        print(f"Turn-by-turn instructions count: {len(instructions)}")
        street_sequence = []
        for idx, inst in enumerate(instructions):
            msg = inst.get("message", "")
            street = inst.get("street", "")
            dist = inst.get("routeOffsetInMeters", 0)
            road_num = inst.get("roadNumbers", [])
            street_sequence.append(f"{idx+1}. [{dist}m] {msg} -> street='{street}', roadNumbers={road_num}")
            
        print("Sequence of steps:")
        for s in street_sequence:
            print(f"   {s}")

if __name__ == "__main__":
    diagnose_corridor("Electronic City to Koramangala", (12.8399, 77.6770), (12.9352, 77.6244))
    diagnose_corridor("Hebbal to Indiranagar", (13.0358, 77.5970), (12.9784, 77.6408))
