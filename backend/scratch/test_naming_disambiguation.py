import os
import sys
import json
import re
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

def build_distinct_route_names(routes):
    """
    Builds distinct, human-readable route descriptions for a list of TomTom alternatives.
    1. Distance-weights road segments (ignoring first & last driveway steps).
    2. Identifies key distinct arterial roads per route.
    3. Disambiguates any colliding or duplicate base names.
    """
    if not routes:
        return []

    route_stats = []

    for i, r in enumerate(routes):
        summary = r.get("summary", {})
        guidance = r.get("guidance", {})
        instructions = guidance.get("instructions", [])
        total_len = summary.get("lengthInMeters", 0)
        free_sec = summary.get("noTrafficTravelTimeInSeconds", 1)
        free_speed_kmh = (total_len / 1000.0) / (free_sec / 3600.0) if free_sec > 0 else 0

        # Calculate distance on each road
        road_lengths = {}
        special_tags = []
        num_inst = len(instructions)

        for idx in range(num_inst):
            inst = instructions[idx]
            curr_offset = inst.get("routeOffsetInMeters", 0)
            next_offset = instructions[idx + 1].get("routeOffsetInMeters", total_len) if idx + 1 < num_inst else total_len
            step_len = max(0, next_offset - curr_offset)

            street = inst.get("street", "").strip()
            msg = inst.get("message", "")

            combined_text = f"{street} {msg}".lower()
            if "flyover" in combined_text or "e c flyover" in combined_text:
                if "Flyover" not in special_tags:
                    special_tags.append("Flyover")
            if "elevated" in combined_text or "expressway" in combined_text:
                if "Elevated" not in special_tags:
                    special_tags.append("Elevated")

            # Exclude immediate departure and arrival steps (if route has enough steps)
            if num_inst > 3 and (idx == 0 or idx == num_inst - 1):
                continue

            if street:
                road_lengths[street] = road_lengths.get(street, 0) + step_len

        # Sort roads by distance descending
        sorted_roads = sorted(road_lengths.items(), key=lambda x: x[1], reverse=True)
        
        # Roads that account for >= 10% of route or >= 1.2 km
        major_roads = [rd for rd, l in sorted_roads if l >= max(1200, total_len * 0.08)]
        if not major_roads and sorted_roads:
            major_roads = [sorted_roads[0][0]]

        route_stats.append({
            "index": i + 1,
            "total_len": total_len,
            "free_speed_kmh": free_speed_kmh,
            "special_tags": special_tags,
            "sorted_roads": sorted_roads,
            "major_roads": major_roads,
            "primary": major_roads[0] if major_roads else f"Route {i+1}",
            "secondary": major_roads[1] if len(major_roads) > 1 else None,
        })

    # Step 1: Assign initial candidate names based on top 1-2 distance-weighted roads
    for rs in route_stats:
        if rs.get("secondary"):
            rs["name"] = f"via {rs['primary']} & {rs['secondary']}"
        else:
            rs["name"] = f"via {rs['primary']}"

    # Step 2: Disambiguate identical or similar names across options
    def norm_corridor(text):
        return re.sub(r'\b(main road|road|rd|outer ring road|orr|expressway|flyover)\b', '', text.lower()).strip()

    for i in range(len(route_stats)):
        for j in range(i + 1, len(route_stats)):
            r1 = route_stats[i]
            r2 = route_stats[j]

            p1 = norm_corridor(r1["primary"])
            p2 = norm_corridor(r2["primary"])
            s1 = norm_corridor(r1["secondary"] or "")
            s2 = norm_corridor(r2["secondary"] or "")

            # If both options have identical names or share the same primary & secondary corridor
            if r1["name"] == r2["name"] or (p1 and p2 and p1 == p2 and s1 == s2):
                # If one is distinctly faster/higher free-flow speed or has Flyover tag
                if "Flyover" in r1["special_tags"] or "Elevated" in r1["special_tags"]:
                    r1["name"] = f"via {r1['primary']} (Elevated Flyover)"
                    r2["name"] = f"via {r2['primary']} (Surface Road)"
                elif "Flyover" in r2["special_tags"] or "Elevated" in r2["special_tags"]:
                    r2["name"] = f"via {r2['primary']} (Elevated Flyover)"
                    r1["name"] = f"via {r1['primary']} (Surface Road)"
                elif abs(r1["free_speed_kmh"] - r2["free_speed_kmh"]) >= 2.5:
                    if r1["free_speed_kmh"] > r2["free_speed_kmh"]:
                        r1["name"] = f"via {r1['primary']} (Main Express)"
                        r2["name"] = f"via {r2['primary']} (Surface Road)"
                    else:
                        r2["name"] = f"via {r2['primary']} (Main Express)"
                        r1["name"] = f"via {r1['primary']} (Surface Road)"
                else:
                    # Append distinguishing secondary road from sorted_roads if available
                    sec1 = next((rd for rd, _ in r1["sorted_roads"] if norm_corridor(rd) != p1), None)
                    sec2 = next((rd for rd, _ in r2["sorted_roads"] if norm_corridor(rd) != p2), None)
                    if sec1 and sec2 and sec1 != sec2:
                        r1["name"] = f"via {r1['primary']} & {sec1}"
                        r2["name"] = f"via {r2['primary']} & {sec2}"
                    else:
                        r1["name"] = f"{r1['name']} (Option {r1['index']})"
                        r2["name"] = f"{r2['name']} (Option {r2['index']})"

    # Final guarantee: ensure 100% uniqueness in the returned array
    seen_names = {}
    for rs in route_stats:
        curr = rs["name"]
        if curr in seen_names:
            seen_names[curr] += 1
            rs["name"] = f"{curr} (Alternative {seen_names[curr]})"
        else:
            seen_names[curr] = 1

    return [rs["name"] for rs in route_stats]


corridors = [
    ("Whitefield to MG Road", (12.9698, 77.7499), (12.9756, 77.6068)),
    ("Electronic City to Koramangala", (12.8399, 77.6770), (12.9352, 77.6244)),
    ("Hebbal to Indiranagar", (13.0358, 77.5970), (12.9784, 77.6408))
]

for name, origin, dest in corridors:
    routes = get_routes(origin[0], origin[1], dest[0], dest[1])
    names = build_distinct_route_names(routes)
    print(f"\n=================== {name} ===================")
    for idx, n in enumerate(names):
        print(f"  Option {idx+1}: {n}")
