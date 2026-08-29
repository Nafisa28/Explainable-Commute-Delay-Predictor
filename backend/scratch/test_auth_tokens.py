import os
import sys
from dotenv import load_dotenv
from supabase import create_client

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# Test creating/logging in a test user
test_email = "test_commuter_coords_2026@gmail.com"
test_password = "TestPassword123!@"

try:
    auth_res = supabase.auth.sign_up({"email": test_email, "password": test_password})
    print("Sign up response:", auth_res)
    token = auth_res.session.access_token if auth_res.session else None
except Exception as e:
    print("Sign up error:", e)

try:
    login_res = supabase.auth.sign_in_with_password({"email": test_email, "password": test_password})
    print("Login response session:", bool(login_res.session))
    token = login_res.session.access_token
    user_res = supabase.auth.get_user(token)
    print("get_user result:", user_res.user.id, user_res.user.email)
except Exception as e:
    print("Login error:", e)
