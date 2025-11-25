"""
Cloud Configuration - Detects environment and provides appropriate settings
"""
import os
from pathlib import Path

# Detect environment
ENVIRONMENT = os.getenv('RENDER') and 'cloud' or 'local'

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent
CLIPS_DIR = PROJECT_ROOT / "Clips"

# Database configuration
if ENVIRONMENT == 'cloud':
    # Render provides DATABASE_URL automatically when you link PostgreSQL
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set in cloud environment")

    # Cloud uses PostgreSQL
    DB_TYPE = 'postgresql'

    # Video storage
    STORAGE_TYPE = 'r2'  # Cloudflare R2
    R2_ENDPOINT = os.getenv('R2_ENDPOINT_URL')
    R2_ACCESS_KEY = os.getenv('R2_ACCESS_KEY')
    R2_SECRET_KEY = os.getenv('R2_SECRET_KEY')
    R2_BUCKET = os.getenv('R2_BUCKET_NAME', 'ou-basketball-clips')

else:
    # Local uses SQLite
    DATABASE_URL = f"sqlite:///{PROJECT_ROOT / 'data' / 'analytics.sqlite'}"
    DB_TYPE = 'sqlite'

    # Local video storage
    STORAGE_TYPE = 'local'
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)

# Authentication
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-change-in-production')
JWT_EXPIRATION_DAYS = 30  # 30-day "remember me" tokens

# User credentials (format: username:bcrypt_hash:role)
# In production, set via environment variable
USERS = os.getenv('USERS', 'admin:$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eCy8cW0L6LbK:admin')

def get_config():
    """Return current configuration as a dictionary"""
    return {
        'environment': ENVIRONMENT,
        'database_url': DATABASE_URL,
        'db_type': DB_TYPE,
        'storage_type': STORAGE_TYPE,
        'clips_dir': str(CLIPS_DIR),
        'jwt_secret': JWT_SECRET_KEY,
        'r2_configured': STORAGE_TYPE == 'r2' and all([R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY]),
    }

def is_cloud():
    """Check if running in cloud environment"""
    return ENVIRONMENT == 'cloud'

def is_local():
    """Check if running in local environment"""
    return ENVIRONMENT == 'local'
