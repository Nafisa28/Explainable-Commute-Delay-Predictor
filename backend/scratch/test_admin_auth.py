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

test_email = "test_commuter_auth@gmail.com"
test_password = "TestPassword123!@"

# Create or confirm user using Admin API
try:
    user_res = supabase.auth.admin.create_user({
        "email": test_email,
        "password": test_password,
        "email_confirm": True
    })
    print("Admin created user:", user_res.user.id)
except Exception as e:
    print("Admin create note:", e)

# Login
login_res = supabase.auth.sign_in_with_password({
    "email": test_email,
    "password": test_password
})

token = login_res.session.access_token
print("Logged in successfully! Token length:", len(token))

# Verify token using get_user
verified_user = supabase.auth.get_user(token)
print("Verified user ID:", verified_user.user.id, "email:", verified_user.user.email)
