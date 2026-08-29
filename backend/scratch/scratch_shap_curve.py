"""
Inspect SHAP values as a function of congestion_ratio and background/base values.
"""
import os
import sys
import shap
import joblib
import pandas as pd
import numpy as np

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.explainability.shap_explainer_v2 import get_explainer_v2, FEATURE_COLUMNS_V2, _model_categories_v2

def main():
    explainer, bundle = get_explainer_v2()
    model = bundle['model']
    
    print(f"Model base_score / expected_value: {explainer.expected_value}")
    
    # Let's test a baseline row across varying congestion_ratio from 1.0 to 4.0
    ratios = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0]
    
    rows = []
    for r in ratios:
        row = {
            "congestion_ratio": r,
            "hour_sin": 0.5,
            "hour_cos": 0.866,
            "day_of_week": 3,
            "is_weekend": 0,
            "is_holiday": False,
            "rainfall_mm": 0.0,
            "temperature": 20.66,
            "condition": "Clouds",
            "visibility": 10000.0,
            "has_event": 0,
            "distance_to_event_km": 999.0
        }
        rows.append(row)
        
    df = pd.DataFrame(rows, columns=FEATURE_COLUMNS_V2)
    df['condition'] = pd.Categorical(df['condition'], categories=_model_categories_v2['condition'])
    
    preds = model.predict(df)
    shap_expl = explainer(df)
    shap_vals = shap_expl.values
    
    cr_idx = FEATURE_COLUMNS_V2.index('congestion_ratio')
    
    print("\n=== SHAP ATTRIBUTION vs CONGESTION RATIO ===")
    print(f"{'Ratio':>7s} | {'Predicted Delay':>15s} | {'SHAP(congestion_ratio)':>25s} | {'Sum all SHAP':>15s} | {'Base + Sum':>12s}")
    print("-" * 85)
    for i, r in enumerate(ratios):
        cr_shap = shap_vals[i, cr_idx]
        sum_shap = np.sum(shap_vals[i])
        print(f"{r:7.2f} | {preds[i]:15.4f} | {cr_shap:+25.4f} | {sum_shap:+15.4f} | {explainer.expected_value + sum_shap:12.4f}")

    # Also let's check what the mean congestion_ratio was in training data vs mean prediction
    # In training data: mean congestion_ratio is 1.604.
    # At congestion_ratio < 1.604 (e.g. 1.11, 1.32, 1.47), congestion is BELOW the training dataset average (1.604)!
    # When a feature value is BELOW its dataset average / expected value, its SHAP value is naturally NEGATIVE (it pulls prediction down below the base_value/expected_value)!

if __name__ == '__main__':
    main()
