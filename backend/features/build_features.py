import numpy as np
import pandas as pd
from .constants import BENGALURU_HOLIDAYS_2026

def build_feature_table(traffic_df: pd.DataFrame, weather_df: pd.DataFrame, events_df: pd.DataFrame) -> pd.DataFrame:
    """
    Builds a feature-engineered DataFrame from traffic logs, weather logs, and events data.
    
    Parameters:
    - traffic_df: DataFrame matching the traffic_logs schema
    - weather_df: DataFrame matching the weather_logs schema
    - events_df: DataFrame matching the events schema
    
    Returns:
    - Feature-engineered DataFrame sorted by timestamp
    """
    if traffic_df.empty:
        return pd.DataFrame()
        
    # Make a copy to avoid mutating the input
    df = traffic_df.copy()
    
    # 1. Convert timestamps to datetime64 UTC
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
    df = df.sort_values('timestamp')
    
    # 2. Temporal features
    hour_fraction = df['timestamp'].dt.hour + df['timestamp'].dt.minute / 60.0 + df['timestamp'].dt.second / 3600.0
    df['hour_sin'] = np.sin(2 * np.pi * hour_fraction / 24.0)
    df['hour_cos'] = np.cos(2 * np.pi * hour_fraction / 24.0)
    
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    
    # Check is_holiday using date set
    df['is_holiday'] = df['timestamp'].dt.date.isin(BENGALURU_HOLIDAYS_2026)
    
    # 3. Weather features (joined by nearest timestamp)
    if weather_df.empty:
        for col in ['rainfall_mm', 'temperature', 'condition', 'visibility']:
            df[col] = np.nan
    else:
        w_df = weather_df.copy()
        w_df['timestamp'] = pd.to_datetime(w_df['timestamp'], utc=True)
        w_df = w_df.sort_values('timestamp')
        
        # Merge by nearest timestamp
        df = pd.merge_asof(
            df,
            w_df,
            on='timestamp',
            direction='nearest'
        )
        
    # 4. Events features (joined by date and route_ids_affected)
    if events_df.empty:
        df['has_event'] = 0
        df['event_type'] = np.nan
        df['distance_to_event_km'] = np.nan
    else:
        e_df = events_df.copy()
        # Parse date to date objects
        e_df['date'] = pd.to_datetime(e_df['date']).dt.date
        
        # Explode route_ids_affected list to match route_id
        # Supabase returns them as lists or strings of lists, let's handle lists
        e_df = e_df.explode('route_ids_affected')
        e_df = e_df.rename(columns={'route_ids_affected': 'route_id'})
        
        # Clean UUID formats (convert to lower strings for joining)
        e_df['route_id'] = e_df['route_id'].astype(str).str.lower()
        df['route_id'] = df['route_id'].astype(str).str.lower()
        
        # Sort and keep the closest event if duplicates exist for a route on a date
        e_df = e_df.sort_values('distance_to_route_km')
        e_df = e_df.drop_duplicates(subset=['date', 'route_id'], keep='first')
        
        # Join on date and route_id
        df['date_only'] = df['timestamp'].dt.date
        df = pd.merge(
            df,
            e_df[['date', 'route_id', 'event_type', 'distance_to_route_km']],
            left_on=['date_only', 'route_id'],
            right_on=['date', 'route_id'],
            how='left'
        )
        
        df['has_event'] = df['event_type'].notna().astype(int)
        df = df.rename(columns={'distance_to_route_km': 'distance_to_event_km'})
        df = df.drop(columns=['date_only', 'date'])
        
    # 5. Historical/lag features
    # Ensure DataFrame is sorted by timestamp to prevent data leakage in cumulative/shift operations
    df = df.sort_values('timestamp')
    
    # last_observed_travel_time: most recent travel_time_min for same route_id + path_variant
    df['last_observed_travel_time'] = df.groupby(['route_id', 'path_variant'])['travel_time_min'].shift(1)
    
    # historical_avg_delay: rolling average travel_time_min for same route_id + path_variant + hour_of_day + day_of_week
    # derived from all prior rows matching the combination
    df['hour_of_day'] = df['timestamp'].dt.hour
    group_cols = ['route_id', 'path_variant', 'hour_of_day', 'day_of_week']
    
    cum_sum = df.groupby(group_cols)['travel_time_min'].transform(lambda x: x.cumsum().shift(1))
    cum_count = df.groupby(group_cols).cumcount()
    df['historical_avg_delay'] = cum_sum / cum_count.replace(0, np.nan)
    
    # 6. Target variable
    # delay_min: travel_time_min minus the minimum observed travel_time_min for same route_id + path_variant (free flow baseline)
    min_travel_time = df.groupby(['route_id', 'path_variant'])['travel_time_min'].transform('min')
    df['delay_min'] = df['travel_time_min'] - min_travel_time
    
    return df
