"""
Live Traffic Features Module - Commute Delay Predictor

This module provides functions to query TomTom's Routing API for live and
free-flow travel times to compute a real-time congestion ratio.
"""

import os
import sys
import requests

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv

class TomTomAPIError(Exception):
    """Base exception for all TomTom API issues."""
    pass

class TomTomTimeoutError(TomTomAPIError):
    """Raised when the TomTom API request times out."""
    pass

class TomTomRateLimitError(TomTomAPIError):
    """Raised when the TomTom API rate limit is exceeded."""
    pass

class TomTomValidationError(TomTomAPIError):
    """Raised when the request parameters or coordinates are invalid."""
    pass


def get_live_traffic_features(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float
) -> dict:
    """
    Queries the TomTom Routing API to compute live and free-flow traffic features.

    Parameters:
    - origin_lat: Latitude of the start location
    - origin_lng: Longitude of the start location
    - dest_lat: Latitude of the destination location
    - dest_lng: Longitude of the destination location

    Returns:
    - dict with keys:
      - 'congestion_ratio': float (live_travel_time_seconds / free_flow_travel_time_seconds)
      - 'live_travel_time_min': float
      - 'free_flow_travel_time_min': float
      - 'distance_km': float
    """
    # 1. Load API Key
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
    api_key = os.environ.get("TOMTOM_API_KEY")
    if not api_key:
        raise TomTomAPIError("TOMTOM_API_KEY not found in environment variables.")

    # Validate coordinate bounds
    if not (-90 <= origin_lat <= 90) or not (-90 <= dest_lat <= 90):
        raise TomTomValidationError(f"Invalid latitudes: origin_lat={origin_lat}, dest_lat={dest_lat}")
    if not (-180 <= origin_lng <= 180) or not (-180 <= dest_lng <= 180):
        raise TomTomValidationError(f"Invalid longitudes: origin_lng={origin_lng}, dest_lng={dest_lng}")

    locations = f"{origin_lat},{origin_lng}:{dest_lat},{dest_lng}"
    url = f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json"

    # Single call to retrieve both live and no-traffic travel times
    params = {
        "key": api_key,
        "traffic": "true",
        "departAt": "now",
        "computeTravelTimeFor": "all"
    }

    try:
        response = requests.get(url, params=params, timeout=8.0)
    except requests.exceptions.Timeout as e:
        raise TomTomTimeoutError(f"TomTom API request timed out: {e}")
    except requests.exceptions.RequestException as e:
        raise TomTomAPIError(f"TomTom API request failed: {e}")

    if response.status_code == 400:
        raise TomTomValidationError(f"TomTom validation error (400): {response.text}")
    elif response.status_code == 403:
        text = response.text.lower()
        if "rate limit" in text or "too many requests" in text or "quota" in text:
            raise TomTomRateLimitError(f"TomTom rate limit or quota exceeded (403): {response.text}")
        raise TomTomAPIError(f"TomTom authentication or permission error (403): {response.text}")
    elif response.status_code == 429:
        raise TomTomRateLimitError(f"TomTom rate limit exceeded (429): {response.text}")
    elif response.status_code >= 500:
        raise TomTomAPIError(f"TomTom server error ({response.status_code}): {response.text}")
    elif response.status_code != 200:
        raise TomTomAPIError(f"TomTom API returned unexpected status code {response.status_code}: {response.text}")

    try:
        data = response.json()
    except ValueError as e:
        raise TomTomAPIError(f"Failed to decode TomTom response JSON: {e}")

    if "routes" not in data or not data["routes"]:
        raise TomTomAPIError(f"TomTom response is missing route data: {response.text}")

    try:
        summary = data["routes"][0]["summary"]
        
        live_time_sec = float(summary["travelTimeInSeconds"])
        free_time_sec = float(summary["noTrafficTravelTimeInSeconds"])
        distance_meters = float(summary["lengthInMeters"])
    except (KeyError, IndexError, TypeError, ValueError) as e:
        raise TomTomAPIError(f"Error parsing required summary fields from TomTom response: {e}")

    if free_time_sec <= 0:
        raise TomTomAPIError(f"TomTom returned invalid free-flow travel time: {free_time_sec} seconds")

    congestion_ratio = live_time_sec / free_time_sec
    live_travel_time_min = live_time_sec / 60.0
    free_flow_travel_time_min = free_time_sec / 60.0
    distance_km = distance_meters / 1000.0

    return {
        "congestion_ratio": congestion_ratio,
        "live_travel_time_min": live_travel_time_min,
        "free_flow_travel_time_min": free_flow_travel_time_min,
        "distance_km": distance_km
    }
