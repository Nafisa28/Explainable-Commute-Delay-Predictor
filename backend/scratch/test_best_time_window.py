import os
import sys
import time
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

from backend.explainability.shap_explainer_v2 import prepare_feature_row_v2, get_explainer_v2, explain_prediction_v2
from backend.inference.live_traffic_features import get_live_traffic_features
from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# Whitefield to MG Road during morning peak
origin_lat, origin_lng = 12.9698, 77.7499
dest_lat, dest_lng = 12.9756, 77.6068

# Monday 8:30 AM IST (3:00 AM UTC)
departure_peak = datetime(2026, 8, 31, 3, 0, 0, tzinfo=timezone.utc)

start_t = time.time()
traffic = get_live_traffic_features(origin_lat, origin_lng, dest_lat, dest_lng)
free_flow = traffic["free_flow_travel_time_min"]
live_now = traffic["live_travel_time_min"]
print(f"Traffic fetched in {time.time() - start_t:.2f}s: Live={live_now:.1f}m, Free-flow={free_flow:.1f}m")

_, bundle = get_explainer_v2()
model = bundle['model']

candidates = []
for step in range(0, 151, 15):
    t_cand = departure_peak + timedelta(minutes=step)
    ist_time = t_cand + timedelta(hours=5, minutes=30)
    
    row = prepare_feature_row_v2(
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
        departure_time=t_cand,
        supabase_client=supabase
    )
    predicted_delay = float(model.predict(row)[0])
    est_travel_time = free_flow + max(0.0, predicted_delay)
    candidates.append((t_cand, ist_time, predicted_delay, est_travel_time))
    print(f"  +{step:3d} min ({ist_time.strftime('%I:%M %p')}) -> Predicted Delay: +{predicted_delay:.2f}m | Est Travel Time: {est_travel_time:.1f}m")

best_cand = min(candidates, key=lambda c: c[3])
current_travel_time = candidates[0][3]
savings = max(0.0, current_travel_time - best_cand[3])

print(f"\nCurrent ({candidates[0][1].strftime('%I:%M %p')}): {current_travel_time:.1f} min")
print(f"Recommended ({best_cand[1].strftime('%I:%M %p')}): {best_cand[3]:.1f} min")
print(f"Savings: {savings:.1f} min")
