"""
PostgreSQL Database Adapter for Cloud Environment
Provides same interface as analytics_db.py but uses PostgreSQL
"""
import psycopg
from psycopg.rows import dict_row
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional
from cloud_config import DATABASE_URL

# SQL to create tables (PostgreSQL syntax)
CREATE_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        source_video TEXT,
        game_id INTEGER,
        canonical_game_id TEXT,
        canonical_clip_id TEXT,
        opponent TEXT,
        opponent_slug TEXT,
        location TEXT,
        game_score TEXT,
        quarter INTEGER,
        possession INTEGER,
        situation TEXT,
        formation TEXT,
        play_name TEXT,
        scout_coverage TEXT,
        play_trigger TEXT,
        action_types TEXT,
        action_sequence TEXT,
        coverage TEXT,
        ball_screen TEXT,
        off_ball_screen TEXT,
        help_rotation TEXT,
        disruption TEXT,
        breakdown TEXT,
        result TEXT,
        paint_touch TEXT,
        shooter TEXT,
        shot_location TEXT,
        contest TEXT,
        rebound TEXT,
        points INTEGER,
        has_shot TEXT,
        shot_x TEXT,
        shot_y TEXT,
        shot_result TEXT,
        player_designation TEXT,
        notes TEXT,
        start_time TEXT,
        end_time TEXT,
        actions_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_clips_game ON clips (game_id)",
    "CREATE INDEX IF NOT EXISTS idx_clips_canonical_game ON clips (canonical_game_id)",
    "CREATE INDEX IF NOT EXISTS idx_clips_canonical_clip ON clips (canonical_clip_id)",
    """
    CREATE TABLE IF NOT EXISTS comm_segments (
        id SERIAL PRIMARY KEY,
        clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
        start REAL NOT NULL,
        \"end\" REAL NOT NULL,
        duration REAL NOT NULL,
        peak_dbfs REAL,
        rms REAL,
        rms_dbfs REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_comm_clip ON comm_segments (clip_id)",
    "CREATE INDEX IF NOT EXISTS idx_comm_start ON comm_segments (clip_id, start)",
    """
    CREATE TABLE IF NOT EXISTS delete_requests (
        id TEXT PRIMARY KEY,
        requested_by TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_delete_requests_status ON delete_requests (status)",
    """
    CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        item_type TEXT,
        item_id TEXT,
        changes JSONB,
        ip_address TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log (timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (username)",
]


def get_connection():
    """Get PostgreSQL connection with dict cursor"""
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    return conn


@contextmanager
def db_cursor():
    """Context manager for database operations"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database schema"""
    with db_cursor() as cur:
        for stmt in CREATE_STATEMENTS:
            cur.execute(stmt)


def upsert_clip(clip: Dict[str, Any]) -> None:
    """Insert or update a clip record"""
    normalized = clip.copy()
    now = datetime.utcnow().isoformat()
    normalized.setdefault("created_at", now)
    normalized["updated_at"] = now

    columns = [
        "id", "filename", "path", "source_video", "game_id",
        "canonical_game_id", "canonical_clip_id", "opponent", "opponent_slug",
        "quarter", "possession", "situation", "formation", "play_name",
        "scout_coverage", "play_trigger", "action_types", "action_sequence",
        "coverage", "ball_screen", "off_ball_screen", "help_rotation",
        "disruption", "breakdown", "result", "paint_touch", "shooter",
        "shot_location", "contest", "rebound", "points", "has_shot",
        "shot_x", "shot_y", "shot_result", "notes", "start_time",
        "end_time", "created_at", "updated_at", "location", "game_score",
        "player_designation", "actions_json",
    ]

    # PostgreSQL uses %s placeholders instead of ?
    placeholders = ", ".join("%s" for _ in columns)
    assignments = ", ".join(f"{col}=EXCLUDED.{col}" for col in columns if col not in {"id", "created_at"})

    values = [normalized.get(col) for col in columns]

    with db_cursor() as cur:
        sql = f"""
            INSERT INTO clips ({", ".join(columns)})
            VALUES ({placeholders})
            ON CONFLICT(id) DO UPDATE SET {assignments}
        """
        cur.execute(sql, values)


def fetch_clips() -> List[Dict[str, Any]]:
    """Fetch all clips"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM clips ORDER BY created_at DESC")
        results = cur.fetchall()
        # Convert RealDictRow to regular dict
        return [dict(row) for row in results]


def fetch_clip(clip_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single clip by ID"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM clips WHERE id = %s", (clip_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def remove_game(game_identifier: Optional[str], canonical_game_id: Optional[str] = None) -> int:
    """Remove all clips for a game"""
    with db_cursor() as cur:
        if canonical_game_id:
            cur.execute("DELETE FROM clips WHERE canonical_game_id = %s", (canonical_game_id,))
        elif game_identifier:
            cur.execute("DELETE FROM clips WHERE game_id::text = %s", (str(game_identifier),))
        else:
            return 0
        return cur.rowcount


def create_delete_request(username: str, item_type: str, item_id: str, item_name: str, reason: str) -> str:
    """Create a delete request"""
    import uuid
    request_id = str(uuid.uuid4())

    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO delete_requests (id, requested_by, item_type, item_id, item_name, reason)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (request_id, username, item_type, item_id, item_name, reason))

    return request_id


def get_pending_delete_requests() -> List[Dict[str, Any]]:
    """Get all pending delete requests"""
    with db_cursor() as cur:
        cur.execute("""
            SELECT * FROM delete_requests
            WHERE status = 'pending'
            ORDER BY created_at DESC
        """)
        results = cur.fetchall()
        return [dict(row) for row in results]


def approve_delete_request(request_id: str, admin_username: str) -> bool:
    """Approve a delete request and perform the deletion"""
    with db_cursor() as cur:
        # Get the request
        cur.execute("SELECT * FROM delete_requests WHERE id = %s", (request_id,))
        request = cur.fetchone()

        if not request or request['status'] != 'pending':
            return False

        # Mark as approved
        cur.execute("""
            UPDATE delete_requests
            SET status = 'approved', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (admin_username, request_id))

        # Perform the deletion
        if request['item_type'] == 'clip':
            cur.execute("DELETE FROM clips WHERE id = %s", (request['item_id'],))
        elif request['item_type'] == 'game':
            cur.execute("DELETE FROM clips WHERE game_id::text = %s", (request['item_id'],))

        return True


def reject_delete_request(request_id: str, admin_username: str) -> bool:
    """Reject a delete request"""
    with db_cursor() as cur:
        cur.execute("""
            UPDATE delete_requests
            SET status = 'rejected', reviewed_by = %s, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = %s AND status = 'pending'
        """, (admin_username, request_id))
        return cur.rowcount > 0


def log_audit(username: str, action: str, item_type: str = None, item_id: str = None,
              changes: Dict = None, ip_address: str = None) -> None:
    """Log an action to the audit log"""
    import json

    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO audit_log (username, action, item_type, item_id, changes, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (username, action, item_type, item_id, json.dumps(changes) if changes else None, ip_address))


def get_audit_log(limit: int = 100, username: str = None) -> List[Dict[str, Any]]:
    """Get audit log entries"""
    with db_cursor() as cur:
        if username:
            cur.execute("""
                SELECT * FROM audit_log
                WHERE username = %s
                ORDER BY timestamp DESC
                LIMIT %s
            """, (username, limit))
        else:
            cur.execute("""
                SELECT * FROM audit_log
                ORDER BY timestamp DESC
                LIMIT %s
            """, (limit,))

        results = cur.fetchall()
        return [dict(row) for row in results]
