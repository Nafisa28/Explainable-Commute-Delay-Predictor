import os
import sys
from datetime import datetime, timezone, timedelta

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.inference.best_time_v2 import find_best_departure_time_v2

# Monday morning peak departure: 8:45 AM IST (03:15 AM UTC)
peak_departure = datetime(2026, 8, 31, 3, 15, 0, tzinfo=timezone.utc)

origin_lat, origin_lng = 12.9698, 77.7499
dest_lat, dest_lng = 12.9756, 77.6068

result = find_best_departure_time_v2(
    origin_lat=origin_lat,
    origin_lng=origin_lng,
    dest_lat=dest_lat,
    dest_lng=dest_lng,
    current_departure_time=peak_departure,
    origin_name="Whitefield",
    dest_name="MG Road",
    window_hours=4.0,
    step_minutes=15,
)

print("=" * 90)
print(f"WHITEFIELD -> MG ROAD: 4-HOUR FORWARD WINDOW ANALYSIS")
print(f"Departure Starting Point: {result['current_departure_time']} (08:45 AM IST)")
print(f"Distance: {result['distance_km']} km | Free-flow baseline: {result['free_flow_travel_time_min']} min")
print(f"Initial Live Travel Time: {result['current_live_travel_time_min']} min")
print(f"Recommended Departure   : {result['recommended_departure_time']} (Est: {result['recommended_live_travel_time_min']} min)")
print(f"Potential Time Savings  : {result['savings_min']} min")
print("=" * 90)
print(f"{'Step':<5} | {'Offset':<8} | {'UTC Time':<12} | {'IST Time':<12} | {'Pred Delay (min)':<18} | {'Est Travel Time (min)':<22}")
print("-" * 90)

for idx, step in enumerate(result["timeline"]):
    t_utc = datetime.fromisoformat(step["departure_time"])
    t_ist = t_utc + timedelta(hours=5, minutes=30)
    print(f"{idx:<5} | +{step['step_offset_min']:<3} min | {t_utc.strftime('%H:%M UTC'):<12} | {t_ist.strftime('%I:%M %p'):<12} | {step['predicted_delay_min']:+7.2f} min        | {step['travel_time_min']:5.1f} min")

print("=" * 90)
