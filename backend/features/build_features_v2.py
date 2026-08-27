"""
build_features_v2.py
====================
Retrains or processes route-agnostic features.
Computes a simulated congestion_ratio based on historical traffic logs
to allow generalizing commute delay predictions across any route in Bengaluru.
"""

import numpy as np
import pandas as pd
from backend.features.constants import BENGALURU_HOLIDAYS_2026

def build_feature_table_v2(
    traffic_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    events_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Builds the v2 feature-engineered DataFrame.
    """
    if traffic_df.empty:
        return pd.DataFrame()
        
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
    df['is_holiday'] = df['timestamp'].dt.date.isin(BENGALURU_HOLIDAYS_2026)
    
    # 3. Weather features
    if weather_df.empty:
        for col in ['rainfall_mm', 'temperature', 'condition', 'visibility']:
            df[col] = np.nan
    else:
        w_df = weather_df.copy()
        w_df['timestamp'] = pd.to_datetime(w_df['timestamp'], utc=True)
        w_df = w_df.sort_values('timestamp')
        
        df = pd.merge_asof(
            df,
            w_df,
            on='timestamp',
            direction='nearest'
        )
        
    # 4. Events features
    if events_df.empty:
        df['has_event'] = 0
        df['event_type'] = np.nan
        df['distance_to_event_km'] = np.nan
    else:
        e_df = events_df.copy()
        e_df['date'] = pd.to_datetime(e_df['date']).dt.date
        
        e_df = e_df.explode('route_ids_affected')
        e_df = e_df.rename(columns={'route_ids_affected': 'route_id'})
        
        e_df['route_id'] = e_df['route_id'].astype(str).str.lower()
        df['route_id'] = df['route_id'].astype(str).str.lower()
        
        e_df = e_df.sort_values('distance_to_route_km')
        e_df = e_df.drop_duplicates(subset=['date', 'route_id'], keep='first')
        
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
        
    # 5. Route-level free-flow baselines and Congestion Ratio
    # Compute the minimum observed travel time for each route + variant in the historical dataset
    min_travel_time = df.groupby(['route_id', 'path_variant'])['travel_time_min'].transform('min')
    
    # target: delay_min (difference between actual travel time and the free-flow baseline)
    df['delay_min'] = df['travel_time_min'] - min_travel_time
    
    # feature: congestion_ratio (live travel time / free-flow travel time)
    # Clip to minimum of 1.0 to avoid any values slightly less than 1.0 due to noise
    df['congestion_ratio'] = (df['travel_time_min'] / min_travel_time).clip(lower=1.0)
    
    return df
