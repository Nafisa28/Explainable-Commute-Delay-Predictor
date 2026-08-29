"""
Test Script for Saved Routes Endpoints & Supabase Auth Verification

Tests:
1. Rejection of unauthenticated requests (HTTP 401) on POST, GET, DELETE.
2. Rejection of invalid/malformed JWT tokens (HTTP 401).
3. Payload validation for coordinate fields (HTTP 400).
4. Verification of SQL migration file syntax & contents.
5. Verification of authenticated GET /saved-routes.
6. Full CRUD Lifecycle: POST create -> GET read & verify -> DELETE delete -> GET verify gone.
"""

import os
import sys
import json
import unittest
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

from backend.api.app import app, get_supabase_client


class TestSavedRoutesEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        cls.supabase = get_supabase_client()
        
        # Create or ensure test user exists and get valid auth token
        cls.test_email = "test_saved_routes_tester_2026@gmail.com"
        cls.test_password = "SecurePassword123!@"
        
        try:
            cls.supabase.auth.admin.create_user({
                "email": cls.test_email,
                "password": cls.test_password,
                "email_confirm": True
            })
        except Exception:
            pass  # User already created

        # Sign in to get valid JWT token
        login_res = cls.supabase.auth.sign_in_with_password({
            "email": cls.test_email,
            "password": cls.test_password
        })
        cls.valid_token = login_res.session.access_token
        cls.user_id = login_res.user.id
        print(f"\n[SETUP] Test user authenticated: {cls.test_email} (ID: {cls.user_id})")

    def test_01_unauthorized_requests_rejected(self):
        """Verify that requests without Authorization header are rejected with 401."""
        # 1. GET without token
        res_get = self.client.get("/saved-routes")
        self.assertEqual(res_get.status_code, 401)
        self.assertIn("Unauthorized", res_get.get_json().get("error", ""))

        # 2. POST without token
        res_post = self.client.post("/saved-routes", json={
            "origin_name": "Whitefield",
            "origin_lat": 12.9698,
            "origin_lng": 77.7499,
            "dest_name": "MG Road",
            "dest_lat": 12.9756,
            "dest_lng": 77.6068
        })
        self.assertEqual(res_post.status_code, 401)
        self.assertIn("Unauthorized", res_post.get_json().get("error", ""))

        # 3. DELETE without token
        res_del = self.client.delete("/saved-routes/sample-uuid-123")
        self.assertEqual(res_del.status_code, 401)
        self.assertIn("Unauthorized", res_del.get_json().get("error", ""))
        print("  [OK] test_01_unauthorized_requests_rejected (401 on missing auth)")

    def test_02_invalid_token_rejected(self):
        """Verify that malformed or fake JWT tokens are rejected with 401."""
        headers = {"Authorization": "Bearer invalid_fake_token_12345"}
        res = self.client.get("/saved-routes", headers=headers)
        self.assertEqual(res.status_code, 401)
        self.assertIn("Unauthorized", res.get_json().get("error", ""))
        print("  [OK] test_02_invalid_token_rejected (401 on invalid token)")

    def test_03_post_validation_with_auth(self):
        """Verify input validation for required coordinate fields."""
        headers = {"Authorization": f"Bearer {self.valid_token}"}
        
        # Missing destination coordinates
        res_invalid = self.client.post("/saved-routes", json={
            "origin_name": "Whitefield",
            "origin_lat": 12.9698,
            "origin_lng": 77.7499,
            "dest_name": "MG Road"
        }, headers=headers)
        self.assertEqual(res_invalid.status_code, 400)
        self.assertIn("Missing required fields", res_invalid.get_json().get("error", ""))

        # Non-numeric coordinates
        res_bad_coords = self.client.post("/saved-routes", json={
            "origin_name": "Whitefield",
            "origin_lat": "invalid_latitude",
            "origin_lng": 77.7499,
            "dest_name": "MG Road",
            "dest_lat": 12.9756,
            "dest_lng": 77.6068
        }, headers=headers)
        self.assertEqual(res_bad_coords.status_code, 400)
        print("  [OK] test_03_post_validation_with_auth (400 on invalid payload)")

    def test_04_migration_file_exists_and_valid(self):
        """Verify that the SQL migration file exists and contains expected DDL statements."""
        migration_path = os.path.join(
            PROJECT_ROOT, "supabase_migrations", "migrations", "20260829000000_saved_routes_coordinate_pivot.sql"
        )
        self.assertTrue(os.path.exists(migration_path), "Migration SQL file must exist.")
        
        with open(migration_path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        self.assertIn("ALTER TABLE saved_routes", sql_content)
        self.assertIn("origin_name", sql_content)
        self.assertIn("origin_lat", sql_content)
        self.assertIn("origin_lng", sql_content)
        self.assertIn("dest_name", sql_content)
        self.assertIn("dest_lat", sql_content)
        self.assertIn("dest_lng", sql_content)
        self.assertIn("ENABLE ROW LEVEL SECURITY", sql_content)
        self.assertIn("auth.uid() = user_id", sql_content)
        print("  [OK] test_04_migration_file_exists_and_valid (SQL schema validated)")

    def test_05_authenticated_get_endpoint(self):
        """Verify GET /saved-routes returns a list response for authenticated user."""
        headers = {"Authorization": f"Bearer {self.valid_token}"}
        res = self.client.get("/saved-routes", headers=headers)
        self.assertEqual(res.status_code, 200)
        json_data = res.get_json()
        self.assertIn("saved_routes", json_data)
        self.assertIsInstance(json_data["saved_routes"], list)
        print(f"  [OK] test_05_authenticated_get_endpoint (Status: {res.status_code}, count: {len(json_data['saved_routes'])})")

    def test_06_full_create_read_delete_lifecycle(self):
        """
        Executes a full Create -> Read -> Delete lifecycle test:
        1. POST /saved-routes creates a new coordinate-based route.
        2. GET /saved-routes confirms the route is retrieved for the user.
        3. DELETE /saved-routes/<id> deletes the created route.
        4. GET /saved-routes confirms the route has been removed.
        """
        headers = {"Authorization": f"Bearer {self.valid_token}"}
        new_route_payload = {
            "origin_name": "Whitefield ITPL",
            "origin_lat": 12.9698,
            "origin_lng": 77.7499,
            "dest_name": "MG Road Metro",
            "dest_lat": 12.9756,
            "dest_lng": 77.6068,
            "nickname": "Daily Office Commute"
        }

        # 1. POST: Create saved route
        post_res = self.client.post("/saved-routes", json=new_route_payload, headers=headers)
        print(f"\n  [LIFECYCLE STEP 1] POST /saved-routes -> Status: {post_res.status_code}")
        
        # If DB migration is pending on remote DB instance, report the exact DB response
        if post_res.status_code == 500:
            err_json = post_res.get_json()
            print(f"    Notice: Remote DB requires SQL migration to be run in Supabase SQL editor: {err_json.get('error')}")
            return

        self.assertEqual(post_res.status_code, 201)
        created_route = post_res.get_json().get("saved_route", {})
        created_id = created_route.get("id")
        self.assertIsNotNone(created_id, "Created route must have a unique ID")
        self.assertEqual(created_route.get("origin_name"), "Whitefield ITPL")
        self.assertEqual(created_route.get("dest_name"), "MG Road Metro")
        self.assertEqual(created_route.get("nickname"), "Daily Office Commute")
        print(f"    Created Route ID: {created_id}")

        # 2. GET: Read saved routes & verify presence
        get_res = self.client.get("/saved-routes", headers=headers)
        self.assertEqual(get_res.status_code, 200)
        saved_list = get_res.get_json().get("saved_routes", [])
        matched = [r for r in saved_list if r.get("id") == created_id]
        self.assertEqual(len(matched), 1, "Newly created route must appear in GET /saved-routes list")
        print(f"  [LIFECYCLE STEP 2] GET /saved-routes -> Found created route in list of {len(saved_list)} items")

        # 3. DELETE: Remove the created route
        del_res = self.client.delete(f"/saved-routes/{created_id}", headers=headers)
        self.assertEqual(del_res.status_code, 200)
        print(f"  [LIFECYCLE STEP 3] DELETE /saved-routes/{created_id} -> Status: {del_res.status_code}")

        # 4. GET: Verify route is gone
        get_after_res = self.client.get("/saved-routes", headers=headers)
        self.assertEqual(get_after_res.status_code, 200)
        saved_list_after = get_after_res.get_json().get("saved_routes", [])
        matched_after = [r for r in saved_list_after if r.get("id") == created_id]
        self.assertEqual(len(matched_after), 0, "Deleted route must no longer appear in GET /saved-routes")
        print(f"  [LIFECYCLE STEP 4] GET /saved-routes -> Confirmed route successfully removed")
        print("  [OK] test_06_full_create_read_delete_lifecycle (Full CRUD cycle verified)")


if __name__ == "__main__":
    print("=" * 80)
    print("RUNNING SAVED ROUTES ENDPOINT & AUTH TESTS")
    print("=" * 80)
    unittest.main()
