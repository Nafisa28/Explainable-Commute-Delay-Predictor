"""
Best Departure Time Module — Commute Delay Predictor

Provides find_best_departure_time() which evaluates a range of candidate
departure times for a given route+variant and recommends the one with the
lowest predicted delay.
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from supabase import Client
from backend.explainability.shap_explainer import explain_prediction


def find_best_departure_time(
    route_id: str,
    path_variant: str,
    current_departure_time: datetime,
    supabase_client: Optional[Client] = None,
    window_hours: float = 2.5,
    step_minutes: int = 15,
) -> dict:
    """
    Evaluates candidate departure times across a window and returns the time
    with the lowest predicted delay.

    Parameters
    ----------
    route_id : str
        UUID of the route corridor.
    path_variant : str
        The path variant label to evaluate.
    current_departure_time : datetime
        The user's originally requested departure time.
    supabase_client : Client, optional
        An initialised Supabase client.  If None, one is created from env vars.
    window_hours : float
        How many hours ahead of current_departure_time to scan (default 2.5).
    step_minutes : int
        Interval between candidate times in minutes (default 15).

    Returns
    -------
    dict with keys:
        route_name                 : str
        path_variant               : str
        current_departure_time     : str  (ISO 8601)
        current_predicted_delay_min: float
        recommended_departure_time : str  (ISO 8601)
        predicted_delay_min        : float  (at recommended time)
        savings_min                : float  (current − recommended, always >= 0)
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

    # --- 2. Resolve route name once ---
    route_res = (
        supabase_client.table('routes')
        .select('name')
        .eq('id', route_id)
        .execute()
    )
    route_name = route_res.data[0]['name'] if route_res.data else route_id

    # --- 3. Predict delay at the current (user-requested) time ---
    current_result = explain_prediction(
        route_id=route_id,
        departure_time=current_departure_time,
        path_variant=path_variant,
        supabase_client=supabase_client,
        route_name=route_name,
    )
    current_delay = current_result['predicted_delay_min']

    # --- 4. Build candidate departure times ---
    total_steps = int((window_hours * 60) / step_minutes)
    candidates: list[tuple[datetime, float]] = []

    for i in range(total_steps + 1):
        candidate_time = current_departure_time + timedelta(minutes=i * step_minutes)
        result = explain_prediction(
            route_id=route_id,
            departure_time=candidate_time,
            path_variant=path_variant,
            supabase_client=supabase_client,
            route_name=route_name,
        )
        candidates.append((candidate_time, result['predicted_delay_min']))

    # --- 5. Identify the candidate with the lowest delay ---
    best_time, best_delay = min(candidates, key=lambda c: c[1])

    savings = max(0.0, current_delay - best_delay)

    return {
        "route_name": route_name,
        "path_variant": path_variant,
        "current_departure_time": current_departure_time.isoformat(),
        "current_predicted_delay_min": round(current_delay, 4),
        "recommended_departure_time": best_time.isoformat(),
        "predicted_delay_min": round(best_delay, 4),
        "savings_min": round(savings, 4),
    }
