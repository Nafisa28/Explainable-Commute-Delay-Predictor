"""
Flask API Server for Explainable Commute Delay Predictor

Provides endpoints for:
- Real-time delay predictions & SHAP explanations (Model V2)
- Alternate route comparisons (TomTom & Model V2)
- User saved routes management with Supabase Auth verification
"""

import os
import sys
from datetime import datetime, timezone
from typing import Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.explainability.shap_explainer_v2 import explain_prediction_v2
from backend.inference.compare_routes_v2 import compare_alternate_routes

app = Flask(__name__)
# Enable CORS for all routes (allows Next.js frontend on localhost:3000 to call localhost:5000)
CORS(app, resources={r"/*": {"origins": "*"}})

# Global Supabase client cache
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Initializes and returns a singleton Supabase client using environment credentials."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables.")

    _supabase_client = create_client(url, key)
    return _supabase_client


def get_authenticated_user():
    """
    Extracts Bearer token from the Authorization header and verifies it via Supabase Auth.
    Returns the Supabase User object if valid, or None if missing / invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None

    try:
        supabase = get_supabase_client()
        user_res = supabase.auth.get_user(token)
        return user_res.user if user_res and user_res.user else None
    except Exception as e:
        app.logger.warning(f"Supabase auth token verification error: {e}")
        return None


# ── Health Check ─────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "commute-delay-predictor-api"})


# ── Single Route SHAP Prediction Endpoint ───────────────────────────────────

@app.route("/predict/explain", methods=["GET"])
def predict_explain():
    """
    GET /predict/explain
    
    Query Parameters:
      - origin_lat (float, required): Latitude of commute origin
      - origin_lng (float, required): Longitude of commute origin
      - dest_lat (float, required): Latitude of commute destination
      - dest_lng (float, required): Longitude of commute destination
      - departure_time (str, optional): ISO-8601 departure timestamp (defaults to now)
      - origin_name (str, optional): Display name for origin
      - dest_name (str, optional): Display name for destination
      - route_name (str, optional): Override for combined route name
      
    Returns:
      JSON payload conforming to ShapExplanationResponse:
      {
        "route_name": str,
        "predicted_delay_min": float,
        "base_value_min": float,
        "live_travel_time_min": float,
        "free_flow_travel_time_min": float,
        "traffic_delay_min": float,
        "distance_km": float,
        "factors": list of { name, value, shap_value_min, category }
      }
    """
    try:
        # 1. Parse & validate coordinates
        origin_lat_str = request.args.get("origin_lat")
        origin_lng_str = request.args.get("origin_lng")
        dest_lat_str = request.args.get("dest_lat")
        dest_lng_str = request.args.get("dest_lng")

        if not all([origin_lat_str, origin_lng_str, dest_lat_str, dest_lng_str]):
            return jsonify({
                "error": "Missing required coordinate parameters: origin_lat, origin_lng, dest_lat, dest_lng"
            }), 400

        try:
            origin_lat = float(origin_lat_str)
            origin_lng = float(origin_lng_str)
            dest_lat = float(dest_lat_str)
            dest_lng = float(dest_lng_str)
        except ValueError:
            return jsonify({
                "error": "Coordinates must be valid floating point numbers."
            }), 400

        # 2. Parse departure_time
        dep_time_str = request.args.get("departure_time")
        if dep_time_str:
            try:
                clean_iso = dep_time_str.replace("Z", "+00:00")
                departure_time = datetime.fromisoformat(clean_iso)
            except Exception:
                departure_time = datetime.now(timezone.utc)
        else:
            departure_time = datetime.now(timezone.utc)

        # 3. Resolve route display name
        origin_name = request.args.get("origin_name")
        dest_name = request.args.get("dest_name")
        route_name = request.args.get("route_name")

        if not route_name:
            if origin_name and dest_name:
                route_name = f"{origin_name} → {dest_name}"
            elif origin_name:
                route_name = origin_name
            else:
                route_name = f"({origin_lat:.4f}, {origin_lng:.4f}) → ({dest_lat:.4f}, {dest_lng:.4f})"

        # 4. Call Model V2 SHAP Explainer
        result = explain_prediction_v2(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            departure_time=departure_time,
            route_name=route_name,
        )

        return jsonify(result), 200

    except Exception as e:
        app.logger.error(f"Error in /predict/explain: {e}", exc_info=True)
        return jsonify({
            "error": str(e),
            "message": "Failed to compute delay prediction explanation."
        }), 500


# ── Alternate Routes Comparison Endpoint ─────────────────────────────────────

@app.route("/predict/compare-routes", methods=["GET"])
def predict_compare_routes():
    """
    GET /predict/compare-routes

    Query Parameters:
      - origin_lat (float, required): Latitude of commute origin
      - origin_lng (float, required): Longitude of commute origin
      - dest_lat (float, required): Latitude of commute destination
      - dest_lng (float, required): Longitude of commute destination
      - departure_time (str, optional): ISO-8601 departure timestamp (defaults to now)
      - max_alternatives (int, optional): Number of alternatives to request (default 2)
      - origin_name (str, optional): Display name for origin
      - dest_name (str, optional): Display name for destination

    Returns:
      JSON payload with sorted alternate route options:
      {
        "origin": { "name": str, "lat": float, "lng": float },
        "destination": { "name": str, "lat": float, "lng": float },
        "departure_time": str,
        "route_options": list of {
            "route_index": int,
            "description": str,
            "predicted_delay_min": float,
            "congestion_ratio": float,
            "distance_km": float,
            "live_travel_time_min": float,
            "free_flow_travel_time_min": float,
            "is_best": bool
        }
      }
    """
    try:
        # 1. Parse & validate coordinates
        origin_lat_str = request.args.get("origin_lat")
        origin_lng_str = request.args.get("origin_lng")
        dest_lat_str = request.args.get("dest_lat")
        dest_lng_str = request.args.get("dest_lng")

        if not all([origin_lat_str, origin_lng_str, dest_lat_str, dest_lng_str]):
            return jsonify({
                "error": "Missing required coordinate parameters: origin_lat, origin_lng, dest_lat, dest_lng"
            }), 400

        try:
            origin_lat = float(origin_lat_str)
            origin_lng = float(origin_lng_str)
            dest_lat = float(dest_lat_str)
            dest_lng = float(dest_lng_str)
        except ValueError:
            return jsonify({
                "error": "Coordinates must be valid floating point numbers."
            }), 400

        # 2. Parse departure_time
        dep_time_str = request.args.get("departure_time")
        if dep_time_str:
            try:
                clean_iso = dep_time_str.replace("Z", "+00:00")
                departure_time = datetime.fromisoformat(clean_iso)
            except Exception:
                departure_time = datetime.now(timezone.utc)
        else:
            departure_time = datetime.now(timezone.utc)

        # 3. Parse max_alternatives
        try:
            max_alternatives = int(request.args.get("max_alternatives", 2))
            max_alternatives = max(1, min(max_alternatives, 5))
        except ValueError:
            max_alternatives = 2

        origin_name = request.args.get("origin_name", "Origin")
        dest_name = request.args.get("dest_name", "Destination")

        # 4. Run Alternate Routes Comparison
        route_options = compare_alternate_routes(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            departure_time=departure_time,
            max_alternatives=max_alternatives,
        )

        return jsonify({
            "origin": {
                "name": origin_name,
                "lat": origin_lat,
                "lng": origin_lng
            },
            "destination": {
                "name": dest_name,
                "lat": dest_lat,
                "lng": dest_lng
            },
            "departure_time": departure_time.isoformat(),
            "route_options": route_options
        }), 200

    except Exception as e:
        app.logger.error(f"Error in /predict/compare-routes: {e}", exc_info=True)
        return jsonify({
            "error": str(e),
            "message": "Failed to compare alternate routes."
        }), 500


# ── Saved Routes Endpoints (Coordinate-Based with Supabase Auth) ──────────────

@app.route("/saved-routes", methods=["POST"])
def create_saved_route():
    """
    POST /saved-routes
    
    Header:
      Authorization: Bearer <supabase_access_token>
      
    Body (JSON):
      {
        "origin_name": str (required),
        "origin_lat": float (required),
        "origin_lng": float (required),
        "dest_name": str (required),
        "dest_lat": float (required),
        "dest_lng": float (required),
        "nickname": str (optional)
      }
      
    Returns:
      201 Created with the saved route record.
    """
    user = get_authenticated_user()
    if not user:
        return jsonify({
            "error": "Unauthorized",
            "message": "Missing or invalid Supabase authorization token."
        }), 401

    body = request.get_json(silent=True)
    if not body or not isinstance(body, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Request body must be a valid JSON object."
        }), 400

    origin_name = body.get("origin_name")
    origin_lat = body.get("origin_lat")
    origin_lng = body.get("origin_lng")
    dest_name = body.get("dest_name")
    dest_lat = body.get("dest_lat")
    dest_lng = body.get("dest_lng")
    nickname = body.get("nickname")

    if not all([origin_name, origin_lat is not None, origin_lng is not None, dest_name, dest_lat is not None, dest_lng is not None]):
        return jsonify({
            "error": "Missing required fields: origin_name, origin_lat, origin_lng, dest_name, dest_lat, dest_lng"
        }), 400

    try:
        origin_lat_f = float(origin_lat)
        origin_lng_f = float(origin_lng)
        dest_lat_f = float(dest_lat)
        dest_lng_f = float(dest_lng)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Coordinates must be valid floating-point numbers."
        }), 400

    if not (-90 <= origin_lat_f <= 90) or not (-90 <= dest_lat_f <= 90):
        return jsonify({"error": "Invalid latitude range (-90 to 90)."}), 400
    if not (-180 <= origin_lng_f <= 180) or not (-180 <= dest_lng_f <= 180):
        return jsonify({"error": "Invalid longitude range (-180 to 180)."}), 400

    try:
        supabase = get_supabase_client()
        insert_payload = {
            "user_id": user.id,
            "origin_name": str(origin_name).strip(),
            "origin_lat": origin_lat_f,
            "origin_lng": origin_lng_f,
            "dest_name": str(dest_name).strip(),
            "dest_lat": dest_lat_f,
            "dest_lng": dest_lng_f,
            "nickname": str(nickname).strip() if nickname else None,
        }

        res = supabase.table("saved_routes").insert(insert_payload).execute()
        created_row = res.data[0] if res.data else insert_payload

        return jsonify({
            "message": "Saved route created successfully.",
            "saved_route": created_row
        }), 201

    except Exception as e:
        app.logger.error(f"Error in POST /saved-routes: {e}", exc_info=True)
        return jsonify({
            "error": str(e),
            "message": "Failed to create saved route in database."
        }), 500


@app.route("/saved-routes", methods=["GET"])
def get_saved_routes():
    """
    GET /saved-routes
    
    Header:
      Authorization: Bearer <supabase_access_token>
      
    Returns:
      200 OK with list of saved routes for the authenticated user.
    """
    user = get_authenticated_user()
    if not user:
        return jsonify({
            "error": "Unauthorized",
            "message": "Missing or invalid Supabase authorization token."
        }), 401

    try:
        supabase = get_supabase_client()
        res = (
            supabase.table("saved_routes")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .execute()
        )

        return jsonify({
            "saved_routes": res.data or []
        }), 200

    except Exception as e:
        app.logger.error(f"Error in GET /saved-routes: {e}", exc_info=True)
        return jsonify({
            "error": str(e),
            "message": "Failed to retrieve saved routes."
        }), 500


@app.route("/saved-routes/<route_id>", methods=["DELETE"])
def delete_saved_route(route_id: str):
    """
    DELETE /saved-routes/<route_id>
    
    Header:
      Authorization: Bearer <supabase_access_token>
      
    Returns:
      200 OK on successful deletion.
    """
    user = get_authenticated_user()
    if not user:
        return jsonify({
            "error": "Unauthorized",
            "message": "Missing or invalid Supabase authorization token."
        }), 401

    try:
        supabase = get_supabase_client()
        # Delete only if the route belongs to the authenticated user
        res = (
            supabase.table("saved_routes")
            .delete()
            .eq("id", route_id)
            .eq("user_id", user.id)
            .execute()
        )

        return jsonify({
            "message": "Saved route deleted successfully.",
            "deleted_id": route_id
        }), 200

    except Exception as e:
        app.logger.error(f"Error in DELETE /saved-routes/{route_id}: {e}", exc_info=True)
        return jsonify({
            "error": str(e),
            "message": "Failed to delete saved route."
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Commute Delay Predictor Flask API on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
