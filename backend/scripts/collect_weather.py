import os
import sys
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# Ensure scripts directory can import other modules, and setup dotenv path
current_dir = os.path.dirname(os.path.abspath(__file__))
env_paths = [
    os.path.join(current_dir, '..', '.env'),
    os.path.join(current_dir, '..', '..', '.env'),
    os.path.join(current_dir, '.env')
]

loaded = False
for path in env_paths:
    if os.path.exists(path):
        load_dotenv(dotenv_path=path)
        loaded = True
        break
if not loaded:
    load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
weather_api_key = os.environ.get("WEATHER_API_KEY")

def run_collection():
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in the environment.")
        return

    if not weather_api_key or weather_api_key == "your_weather_api_key_here" or not weather_api_key.strip():
        print("Warning: WEATHER_API_KEY is not set or is still a placeholder. Skipping weather data collection.")
        return

    supabase: Client = create_client(supabase_url, supabase_key)
    
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": "Bengaluru",
        "appid": weather_api_key,
        "units": "metric"
    }
    
    print(f"[{datetime.now().isoformat()}] Querying OpenWeatherMap for Bengaluru...")
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # Extract properties
        main_data = data.get('main', {})
        temp = main_data.get('temp')
        visibility = data.get('visibility')
        
        weather_list = data.get('weather', [])
        condition = weather_list[0].get('main') if weather_list else 'Unknown'
        
        rain_data = data.get('rain', {})
        rainfall_mm = rain_data.get('1h', 0.0)
        
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "rainfall_mm": rainfall_mm,
            "temperature": temp,
            "condition": condition,
            "visibility": visibility
        }
        
        supabase.table('weather_logs').insert(log_entry).execute()
        print(f"  Successfully logged weather: Temp: {temp}C, Condition: {condition}, Rain: {rainfall_mm}mm, Visibility: {visibility}m")
        
    except Exception as e:
        print(f"Failed to fetch/log weather data: {e}")

if __name__ == '__main__':
    run_collection()
