# Feature columns used for model training and prediction
FEATURE_COLUMNS = [
    "route_id",
    "path_variant",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    "is_holiday",
    "rainfall_mm",
    "temperature",
    "condition",
    "visibility",
    "has_event",
    "distance_to_event_km",
    "last_observed_travel_time",
    "historical_avg_delay"
]

# Categorical features that need to be cast to pandas category dtype
CATEGORICAL_FEATURES = [
    "route_id",
    "path_variant",
    "condition"
]
