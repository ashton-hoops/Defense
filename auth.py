"""
Authentication system with JWT tokens and role-based access control
"""
import jwt
import bcrypt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from cloud_config import JWT_SECRET_KEY, JWT_EXPIRATION_DAYS, USERS, is_cloud

# Parse users from environment variable
# Format: username:bcrypt_hash:role,username2:hash2:role2
def parse_users():
    """Parse USERS environment variable into dict"""
    users = {}
    for user_str in USERS.split(','):
        parts = user_str.strip().split(':')
        if len(parts) >= 3:
            username = parts[0]
            password_hash = parts[1]
            role = parts[2]
            users[username] = {
                'password_hash': password_hash,
                'role': role
            }
    return users


USER_DB = parse_users()

# Debug: Print loaded users (without password hashes)
if is_cloud():
    print(f"🔐 Loaded {len(USER_DB)} users: {list(USER_DB.keys())}")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def create_jwt_token(username: str, role: str) -> str:
    """Create a JWT token for a user"""
    expiration = datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS)

    payload = {
        'username': username,
        'role': role,
        'exp': expiration
    }

    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')


def verify_jwt_token(token: str) -> dict:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_from_token():
    """Extract user info from request token"""
    auth_header = request.headers.get('Authorization', '')

    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ')[1]
    return verify_jwt_token(token)


def require_auth(f):
    """Decorator to require authentication (any role)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # In local mode, auth is optional (for your local development)
        if not is_cloud():
            return f(*args, **kwargs)

        # In cloud mode, auth is required
        user = get_user_from_token()

        if not user:
            return jsonify({'error': 'Authentication required'}), 401

        # Add user info to request context
        request.user = user

        return f(*args, **kwargs)

    return decorated


def require_admin(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # In local mode, treat as admin
        if not is_cloud():
            request.user = {'username': 'local', 'role': 'admin'}
            return f(*args, **kwargs)

        # In cloud mode, check role
        user = get_user_from_token()

        if not user:
            return jsonify({'error': 'Authentication required'}), 401

        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        request.user = user

        return f(*args, **kwargs)

    return decorated


def require_write(f):
    """Decorator to require write access (admin or coach, but not guest)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # In local mode, allow writes
        if not is_cloud():
            request.user = {'username': 'local', 'role': 'admin'}
            return f(*args, **kwargs)

        # In cloud mode, check role
        user = get_user_from_token()

        if not user:
            return jsonify({'error': 'Authentication required'}), 401

        if user.get('role') == 'guest':
            return jsonify({'error': 'Write access not allowed for guest users'}), 403

        request.user = user

        return f(*args, **kwargs)

    return decorated


def hash_password(plain_password: str) -> str:
    """Hash a password for storage (helper function)"""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def authenticate_user(username: str, password: str) -> dict:
    """Authenticate a user and return user info if valid"""
    user = USER_DB.get(username)

    if not user:
        if is_cloud():
            print(f"🔍 User '{username}' not found in database. Available users: {list(USER_DB.keys())}")
        return None

    if not verify_password(password, user['password_hash']):
        if is_cloud():
            print(f"🔍 Password verification failed for user '{username}'")
        return None

    return {
        'username': username,
        'role': user['role']
    }


# Helper to generate password hashes for setup
if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        password = sys.argv[1]
        print(f"Bcrypt hash: {hash_password(password)}")
    else:
        print("Usage: python auth.py <password>")
        print("Example hashes:")
        print(f"  admin123: {hash_password('admin123')}")
        print(f"  coach123: {hash_password('coach123')}")
