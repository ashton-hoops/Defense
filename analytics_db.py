import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "analytics.sqlite"

CREATE_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_clips_game ON clips (game_id)",
    "CREATE INDEX IF NOT EXISTS idx_clips_canonical_game ON clips (canonical_game_id)",
    "CREATE INDEX IF NOT EXISTS idx_clips_canonical_clip ON clips (canonical_clip_id)",
    """
    CREATE TABLE IF NOT EXISTS comm_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
        start REAL NOT NULL,
        "end" REAL NOT NULL,
        duration REAL NOT NULL,
        peak_dbfs REAL,
        rms REAL,
        rms_dbfs REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_comm_clip ON comm_segments (clip_id)",
    "CREATE INDEX IF NOT EXISTS idx_comm_start ON comm_segments (clip_id, start)",
]


def _dict_factory(cursor: sqlite3.Cursor, row: sqlite3.Row) -> Dict[str, Any]:
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = _dict_factory
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        yield conn.cursor()
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db_cursor() as cur:
        for stmt in CREATE_STATEMENTS:
            cur.execute(stmt)

        # Migration: Add player_designation column if it doesn't exist
        cur.execute("PRAGMA table_info(clips)")
        columns = [col['name'] for col in cur.fetchall()]
        if 'player_designation' not in columns:
            cur.execute("ALTER TABLE clips ADD COLUMN player_designation TEXT")
        if 'play_trigger' not in columns:
            if 'action_trigger' in columns:
                cur.execute("ALTER TABLE clips RENAME COLUMN action_trigger TO play_trigger")
            else:
                cur.execute("ALTER TABLE clips ADD COLUMN play_trigger TEXT")
        if 'actions_json' not in columns:
            cur.execute("ALTER TABLE clips ADD COLUMN actions_json TEXT")


def upsert_clip(clip: Dict[str, Any]) -> None:
    """
    Insert or update a clip record. The dict should contain all normalized fields.
    """
    normalized = clip.copy()
    now = datetime.utcnow().isoformat()
    normalized.setdefault("created_at", now)
    normalized["updated_at"] = now

    # Debug: log what we're about to save
    with open('/tmp/upsert_debug.log', 'a') as f:
        f.write(f"upsert_clip called with location={clip.get('location')}, game_score={clip.get('game_score')}\n")

    columns = [
        "id",
        "filename",
        "path",
        "source_video",
        "game_id",
        "canonical_game_id",
        "canonical_clip_id",
        "opponent",
        "opponent_slug",
        "quarter",
        "possession",
        "situation",
        "formation",
        "play_name",
        "scout_coverage",
        "play_trigger",
        "action_types",
        "action_sequence",
        "coverage",
        "ball_screen",
        "off_ball_screen",
        "help_rotation",
        "disruption",
        "breakdown",
        "result",
        "paint_touch",
        "shooter",
        "shot_location",
        "contest",
        "rebound",
        "points",
        "has_shot",
        "shot_x",
        "shot_y",
        "shot_result",
        "notes",
        "start_time",
        "end_time",
        "created_at",
        "updated_at",
        "location",
        "game_score",
        "player_designation",
        "actions_json",
    ]

    placeholders = ", ".join("?" for _ in columns)
    assignments = ", ".join(f"{col}=excluded.{col}" for col in columns if col not in {"id", "created_at"})

    values = [normalized.get(col) for col in columns]

    # Debug: log the actual values being inserted
    with open('/tmp/upsert_debug.log', 'a') as f:
        f.write(f"  Values for location (index {columns.index('location')}): {values[columns.index('location')]}\n")
        f.write(f"  Values for game_score (index {columns.index('game_score')}): {values[columns.index('game_score')]}\n")
        # Show a snippet of the SQL
        sql_snippet = f"INSERT INTO clips ({', '.join(columns[:5])}...{', '.join(columns[-5:])}) VALUES ..."
        f.write(f"  SQL: {sql_snippet}\n")
        f.write(f"  Total columns: {len(columns)}, Total values: {len(values)}\n")
        # Check if location and game_score are in the update assignments
        f.write(f"  'location' in assignments: {'location=excluded.location' in assignments}\n")
        f.write(f"  'game_score' in assignments: {'game_score=excluded.game_score' in assignments}\n")

    with db_cursor() as cur:
        sql = f"""
            INSERT INTO clips ({", ".join(columns)})
            VALUES ({placeholders})
            ON CONFLICT(id) DO UPDATE SET {assignments}
            """

        # Debug: Write the actual SQL and values to file
        with open('/tmp/sql_debug.log', 'w') as f:
            f.write("SQL Statement:\n")
            f.write(sql + "\n\n")
            f.write("Values:\n")
            for i, (col, val) in enumerate(zip(columns, values)):
                f.write(f"{i}: {col} = {repr(val)}\n")

        cur.execute(sql, values)


def upsert_comm_segments(clip_id: str, segments: Iterable[Dict[str, Any]]) -> None:
    rows = [
        (
            clip_id,
            float(seg["start"]),
            float(seg["end"]),
            float(seg.get("duration", seg["end"] - seg["start"])),
            float(seg.get("peak_dbfs")) if seg.get("peak_dbfs") is not None else None,
            float(seg.get("rms")) if seg.get("rms") is not None else None,
            float(seg.get("rms_dbfs")) if seg.get("rms_dbfs") is not None else None,
        )
        for seg in segments
    ]
    with db_cursor() as cur:
        cur.execute("DELETE FROM comm_segments WHERE clip_id = ?", (clip_id,))
        cur.executemany(
            """
            INSERT INTO comm_segments (clip_id, start, "end", duration, peak_dbfs, rms, rms_dbfs)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )


def fetch_clips() -> List[Dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM clips ORDER BY created_at DESC")
        return cur.fetchall()


def fetch_clip(clip_id: str) -> Optional[Dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM clips WHERE id = ?", (clip_id,))
        return cur.fetchone()


def fetch_comm_segments(clip_id: str) -> List[Dict[str, Any]]:
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, clip_id, start, "end", duration, peak_dbfs, rms, rms_dbfs, created_at
            FROM comm_segments
            WHERE clip_id = ?
            ORDER BY start
            """,
            (clip_id,),
        )
        return cur.fetchall()


def remove_clip(clip_id: str) -> None:
    with db_cursor() as cur:
        cur.execute("DELETE FROM clips WHERE id = ?", (clip_id,))


def remove_game(game_identifier: Any, canonical_game_id: Optional[str] = None) -> int:
    """
    Delete every clip tied to a game. Matches on numeric game_id when provided and optionally on canonical_game_id.
    Returns how many DB rows were removed.
    """
    deleted = 0
    normalized_game_id: Optional[int] = None
    if game_identifier is not None:
        try:
            stringified = str(game_identifier).strip()
            if stringified:
                normalized_game_id = int(stringified)
        except (ValueError, TypeError):
            normalized_game_id = None

    with db_cursor() as cur:
        if normalized_game_id is not None:
            cur.execute("DELETE FROM clips WHERE game_id = ?", (normalized_game_id,))
            deleted += cur.rowcount or 0
        if canonical_game_id:
            cur.execute("DELETE FROM clips WHERE canonical_game_id = ?", (canonical_game_id,))
            deleted += cur.rowcount or 0
    return deleted


def import_clips(records: Iterable[Dict[str, Any]]) -> None:
    for record in records:
        upsert_clip(record)


init_db()
