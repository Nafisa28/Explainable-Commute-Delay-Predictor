import os
import sys
import json
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
api_key = os.environ.get("TOMTOM_API_KEY")

def get_routes(o_lat, o_lng, d_lat, d_lng):
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
    return resp.json().get("routes", [])

def compute_road_distances(route):
    instructions = route.get("guidance", {}).get("instructions", [])
    total_length = route.get("summary", {}).get("lengthInMeters", 0)
    
    if not instructions:
        return {}
    
    # Calculate distance for each step
    road_lengths = {}
    is_elevated = False
    
    num_inst = len(instructions)
    for i in range(num_inst):
        inst = instructions[i]
        curr_offset = inst.get("routeOffsetInMeters", 0)
        next_offset = instructions[i + 1].get("routeOffsetInMeters", total_length) if i + 1 < num_inst else total_length
        step_len = max(0, next_offset - curr_offset)
        
        street = inst.get("street", "").strip()
        msg = inst.get("message", "")
        
        # Detect elevated / tollway indicators in message or street name
        combined_text = f"{street} {msg}".lower()
        if any(w in combined_text for w in ["flyover", "elevated", "expressway", "tollway", "e c flyover"]):
            is_elevated = True
            
        # Ignore step 0 (first step) and last step (arrival step) if route has > 3 steps
        if num_inst > 3:
            if i == 0 or i == num_inst - 1:
                continue
                
        if street:
            # Clean up base road name
            clean_street = street
            road_lengths[clean_street] = road_lengths.get(clean_street, 0) + step_len
            
    return road_lengths, is_elevated

corridors = [
    ("Whitefield to MG Road", (12.9698, 77.7499), (12.9756, 77.6068)),
    ("Electronic City to Koramangala", (12.8399, 77.6770), (12.9352, 77.6244)),
    ("Hebbal to Indiranagar", (13.0358, 77.5970), (12.9784, 77.6408))
]

for name, origin, dest in corridors:
    routes = get_routes(origin[0], origin[1], dest[0], dest[1])
    print(f"\n=================== {name} ===================")
    for idx, r in enumerate(routes):
        road_lens, elevated = compute_road_distances(r)
        sorted_roads = sorted(road_lens.items(), key=lambda x: x[1], reverse=True)
        print(f"\nRoute {idx+1} (Total: {r.get('summary',{}).get('lengthInMeters')}m, Elevated: {elevated}):")
        for rd, l in sorted_roads[:4]:
            print(f"   - {rd}: {l}m ({l/1000.0:.2f} km)")
