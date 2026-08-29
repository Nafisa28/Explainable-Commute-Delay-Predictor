import os
from dotenv import load_dotenv

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

keys = [k for k in os.environ.keys() if any(w in k.lower() for w in ['supa', 'db', 'postgre', 'sql', 'url'])]
print("Available DB/Supabase env keys:", keys)
