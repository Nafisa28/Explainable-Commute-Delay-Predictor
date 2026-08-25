import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timezone

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv
from supabase import create_client, Client
from backend.inference.prepare_features import prepare_feature_row
from backend.explainability.shap_explainer import explain_prediction, get_explainer

def main():
    load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
    load_dotenv(os.path.join(PROJECT_ROOT, '.env'))
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found in env.")
        sys.exit(1)

    supabase: Client = create_client(supabase_url, supabase_key)

    # Fetch active routes
    print("Fetching active routes from Supabase...")
    routes_res = supabase.table('routes').select('*').limit(3).execute()
    if not routes_res.data:
        print("No routes found. Please seed the routes table first.")
        sys.exit(1)

    routes = routes_res.data
    print(f"Loaded {len(routes)} routes for SHAP testing.")

    # Initialize SHAP explainer
    explainer, bundle = get_explainer()
    model = bundle['model']
    
    # Get base value (expected value)
    base_value = explainer.expected_value
    base_value_val = float(base_value[0]) if isinstance(base_value, (np.ndarray, list)) else float(base_value)
    print(f"Model Explainer Base Value (Expected Value): {base_value_val:.4f}")

    # Build test cases
    test_cases = [
        {
            "name": "Standard Departure (Now)",
            "route_id": routes[0]['id'],
            "route_name": routes[0]['name'],
            "departure_time": datetime.now(timezone.utc),
            "path_variant": None
        },
        {
            "name": "Holiday Departure (Independence Day)",
            "route_id": routes[1]['id'] if len(routes) > 1 else routes[0]['id'],
            "route_name": routes[1]['name'] if len(routes) > 1 else routes[0]['name'],
            "departure_time": datetime(2026, 8, 15, 8, 30, 0, tzinfo=timezone.utc),
            "path_variant": None
        }
    ]

    if len(routes) > 2:
        variants = routes[2].get('path_variants', [])
        if len(variants) > 1:
            test_cases.append({
                "name": "Specific Path Variant Override",
                "route_id": routes[2]['id'],
                "route_name": routes[2]['name'],
                "departure_time": datetime.now(timezone.utc),
                "path_variant": variants[1]['label']
            })

    print("\n" + "="*95)
    print("  RUNNING SHAP INTEGRATION VERIFICATION")
    print("="*95)

    for idx, case in enumerate(test_cases):
        print(f"\nScenario {idx+1}: {case['name']}")
        print(f"  Route ID: {case['route_id']}")
        print(f"  Departure: {case['departure_time']}")
        print(f"  Variant: {case['path_variant']}")

        try:
            # 1. Prepare feature row
            df_row = prepare_feature_row(
                route_id=case['route_id'],
                departure_time=case['departure_time'],
                path_variant=case['path_variant'],
                supabase_client=supabase
            )

            # 2. Get prediction explanation
            explanation = explain_prediction(df_row, route_name=case['route_name'])
            prediction = explanation["predicted_delay_min"]
            base_value_val = explanation["base_value_min"]
            factors = explanation["factors"]

            # 3. Sum check
            shap_sum = sum(f.shap_value_min for f in factors)
            reconstructed_pred = base_value_val + shap_sum
            diff = abs(prediction - reconstructed_pred)

            # Print JSON output for Scenario 1
            if idx == 0:
                print("\n  FULL explain_prediction() JSON output for Scenario 1:")
                import json
                print(json.dumps(explanation, indent=2))

            print(f"\n  Model Prediction:                 {prediction:.4f}")
            print(f"  Reconstructed (Base + SHAP sum):  {reconstructed_pred:.4f}")
            print(f"  Additive Identity Match:          {diff < 1e-10} (Difference: {diff:.2e})")

            # 4. Display tabular breakdown
            print("\n  Tabular SHAP Attribution Breakdown:")
            print("  " + "-" * 90)
            print(f"  {'Feature Name':<28} | {'Feature Value':<40} | {'SHAP Attribution':<15}")
            print("  " + "-" * 90)
            
            for f in factors:
                val = f.value
                shap_val = f.shap_value_min
                
                # Format category values nicely
                if isinstance(val, pd.Categorical) or hasattr(val, 'categories'):
                    val_str = str(val)
                else:
                    val_str = f"{val:.4f}" if isinstance(val, (float, np.floating)) else str(val)
                    
                print(f"  {f.name:<28} | {val_str:<40} | {shap_val:+.4f}")
            print("  " + "-" * 90)

        except Exception as e:
            print(f"  [ERROR] TreeExplainer or prediction failed: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "="*95)

if __name__ == '__main__':
    main()
