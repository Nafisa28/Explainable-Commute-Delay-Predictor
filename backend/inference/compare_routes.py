"""
Compare Path Variants Module — Commute Delay Predictor

Provides compare_path_variants() to run SHAP-based predictions across all
path variants of a given route, returning them sorted by predicted delay
so the user can pick the fastest option.
"""

import os
import sys
from datetime import datetime
from typing import Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from supabase import Client
from backend.explainability.shap_explainer import explain_prediction


def compare_path_variants(
    route_id: str,
    departure_time: datetime,
    supabase_client: Optional[Client] = None,
) -> dict:
    """
    Runs explain_prediction() for every path variant of the given route at the
    same departure time.  Returns the results sorted by predicted_delay_min
    ascending (best/fastest option first).

    Parameters
    ----------
    route_id : str
        UUID of the route corridor.
    departure_time : datetime
        The departure timestamp to evaluate.
    supabase_client : Client, optional
        An initialised Supabase client.  If None, one is created from env vars.

    Returns
    -------
    dict with keys:
        route_name : str
        departure_time : str  (ISO 8601)
        options : list[dict]  — each dict contains:
            path_variant        : str
            predicted_delay_min : float
            top_factor          : dict with keys name, value, shap_value_min, category
    """
    # --- 1. Initialise Supabase client if needed ---
    if supabase_client is None:
        from dotenv import load_dotenv
        from supabase import create_client
        load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
        load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set.")
        supabase_client = create_client(url, key)

    # --- 2. Look up all path variants for the route ---
    route_res = (
        supabase_client.table('routes')
        .select('name, path_variants')
        .eq('id', route_id)
        .execute()
    )
    if not route_res.data:
        raise ValueError(f"Route {route_id} not found in the routes table.")

    route_row = route_res.data[0]
    route_name = route_row['name']
    path_variants_json = route_row.get('path_variants') or []

    variant_labels: list[str] = []
    for pv in path_variants_json:
        if isinstance(pv, dict) and 'label' in pv:
            variant_labels.append(pv['label'])
        elif isinstance(pv, str):
            variant_labels.append(pv)

    if not variant_labels:
        raise ValueError(f"No path variants found for route {route_id}.")

    # --- 3. Run explain_prediction() for each variant ---
    options: list[dict] = []
    for label in variant_labels:
        result = explain_prediction(
            route_id=route_id,
            departure_time=departure_time,
            path_variant=label,
            supabase_client=supabase_client,
            route_name=route_name,
        )

        # Pick the single highest-magnitude factor
        factors = result.get('factors', [])
        if factors:
            # factors are already sorted by abs(shap_value_min) desc
            top = factors[0]
            top_factor = {
                "name": top["name"],
                "value": top["value"],
                "shap_value_min": top["shap_value_min"],
                "category": top["category"],
            }
        else:
            top_factor = {"name": "N/A", "value": None, "shap_value_min": 0.0, "category": "unknown"}

        options.append({
            "path_variant": label,
            "predicted_delay_min": result['predicted_delay_min'],
            "top_factor": top_factor,
        })

    # --- 4. Sort by predicted delay ascending (best first) ---
    options.sort(key=lambda o: o['predicted_delay_min'])

    return {
        "route_name": route_name,
        "departure_time": departure_time.isoformat(),
        "options": options,
    }
