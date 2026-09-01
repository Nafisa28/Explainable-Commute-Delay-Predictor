import os
import sys
import unittest
from unittest.mock import patch, MagicMock

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.api.app import app


class TestPredictionHistoryEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_unauthorized_get(self):
        """GET /prediction-history without token should return 401."""
        res = self.client.get('/prediction-history')
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertIn("error", data)

    def test_unauthorized_delete(self):
        """DELETE /prediction-history/<id> without token should return 401."""
        res = self.client.delete('/prediction-history/some-uuid')
        self.assertEqual(res.status_code, 401)

    @patch('backend.api.app.get_authenticated_user')
    @patch('backend.api.app.get_supabase_client')
    def test_authorized_get(self, mock_get_supabase, mock_get_user):
        """GET /prediction-history with valid user should return history list."""
        mock_user = MagicMock()
        mock_user.id = "user-12345"
        mock_get_user.return_value = mock_user

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_order = MagicMock()
        mock_exec = MagicMock()

        mock_exec.data = [
            {
                "id": "pred-1",
                "user_id": "user-12345",
                "requested_time": "2026-09-01T04:30:00+00:00",
                "predicted_delay": 12.4,
                "actual_delay": None,
                "shap_breakdown": {
                    "route_name": "Whitefield → MG Road",
                    "origin_name": "Whitefield",
                    "origin_lat": 12.9698,
                    "origin_lng": 77.7500,
                    "dest_name": "MG Road",
                    "dest_lat": 12.9716,
                    "dest_lng": 77.5946,
                    "distance_km": 15.2,
                    "live_travel_time_min": 42.0,
                    "free_flow_travel_time_min": 25.0,
                    "factors": [
                        {"name": "Rainfall", "value": "Moderate", "shap_value_min": 3.2},
                        {"name": "Peak Hour", "value": "Morning Peak", "shap_value_min": 5.4}
                    ]
                }
            }
        ]

        mock_order.execute.return_value = mock_exec
        mock_eq.order.return_value = mock_order
        mock_select.eq.return_value = mock_eq
        mock_table.select.return_value = mock_select
        mock_supabase.table.return_value = mock_table
        mock_get_supabase.return_value = mock_supabase

        res = self.client.get(
            '/prediction-history',
            headers={"Authorization": "Bearer mock-token"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("prediction_history", data)
        self.assertEqual(len(data["prediction_history"]), 1)
        item = data["prediction_history"][0]
        self.assertEqual(item["route_name"], "Whitefield → MG Road")
        self.assertEqual(item["predicted_delay"], 12.4)
        self.assertEqual(len(item["factors"]), 2)

    @patch('backend.api.app.get_authenticated_user')
    @patch('backend.api.app.get_supabase_client')
    def test_authorized_delete(self, mock_get_supabase, mock_get_user):
        """DELETE /prediction-history/<id> with valid user should delete row."""
        mock_user = MagicMock()
        mock_user.id = "user-12345"
        mock_get_user.return_value = mock_user

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_delete = MagicMock()
        mock_eq1 = MagicMock()
        mock_eq2 = MagicMock()
        mock_exec = MagicMock()

        mock_exec.data = [{"id": "pred-1"}]
        mock_eq2.execute.return_value = mock_exec
        mock_eq1.eq.return_value = mock_eq2
        mock_delete.eq.return_value = mock_eq1
        mock_table.delete.return_value = mock_delete
        mock_supabase.table.return_value = mock_table
        mock_get_supabase.return_value = mock_supabase

        res = self.client.delete(
            '/prediction-history/pred-1',
            headers={"Authorization": "Bearer mock-token"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["deleted_id"], "pred-1")


if __name__ == '__main__':
    unittest.main()
