"""
Flask API Server for Explainable Commute Delay Predictor

Provides endpoints for real-time delay predictions and SHAP-based explanations
using Model V2 and TomTom live traffic data.
"""

import os
import sys
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.explainability.shap_explainer_v2 import explain_prediction_v2

app = Flask(__name__)
# Enable CORS for all routes (allows Next.js frontend on localhost:3000 to call localhost:5000)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "commute-delay-predictor-api"})


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
                # Handle ISO formats including trailing 'Z'
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Commute Delay Predictor Flask API on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
