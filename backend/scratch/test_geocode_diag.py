import urllib.request
import urllib.parse
import json
import os

api_key = "9YlyI62iuUphVmUkL6liaLRSbW7hPjQs"
query = "Basavanagudi"

TOMTOM_SEARCH_URL = "https://api.tomtom.com/search/2/search"

BENGALURU_BIAS = {
  "lat": 12.9716,
  "lon": 77.5946,
  "topLeftLat": 13.15,
  "topLeftLon": 77.4,
  "btmRightLat": 12.75,
  "btmRightLon": 77.8,
}

params = {
    "key": api_key,
    "language": "en-US",
    "limit": "6",
    "countrySet": "IN",
    "lat": str(BENGALURU_BIAS["lat"]),
    "lon": str(BENGALURU_BIAS["lon"]),
    "radius": "50000",
    "topLeft": f"{BENGALURU_BIAS['topLeftLat']},{BENGALURU_BIAS['topLeftLon']}",
    "btmRight": f"{BENGALURU_BIAS['btmRightLat']},{BENGALURU_BIAS['btmRightLon']}",
    "typeahead": "true",
}

query_string = urllib.parse.urlencode(params)
url = f"{TOMTOM_SEARCH_URL}/{urllib.parse.quote(query)}.json?{query_string}"

redacted_url = url.replace(api_key, "REDACTED_API_KEY")
print(f"Constructed URL: {redacted_url}\n")

req = urllib.request.Request(url, headers={"Accept": "application/json"})
try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode('utf-8')
        print(f"Status: {resp.status}")
        print(f"Response: {body[:300]}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error Status Code: {e.code}")
    print(f"HTTP Error Reason: {e.reason}")
    body = e.read().decode('utf-8')
    print(f"Error Response Body: {body}")
except Exception as e:
    print(f"Other Error: {e}")
