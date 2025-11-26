from flask import Flask, send_from_directory, jsonify, request
import requests
from flask_cors import CORS
from pathlib import Path
import json
import os

# Import cloud config to detect environment
try:
    from cloud_config import is_cloud, is_local
    CLOUD_AVAILABLE = True
except ImportError:
    CLOUD_AVAILABLE = False
    def is_cloud(): return False
    def is_local(): return True

# Import authentication decorators
try:
    from auth import require_auth, require_write, require_admin
    AUTH_AVAILABLE = True
except ImportError:
    AUTH_AVAILABLE = False
    # No-op decorators for local development without auth
    def require_auth(f): return f
    def require_write(f): return f
    def require_admin(f): return f

# Use cloud_db in cloud, analytics_db locally
if CLOUD_AVAILABLE and is_cloud():
    print("🌩️  Running in CLOUD mode - using PostgreSQL")
    from cloud_db import fetch_clips, fetch_clip, upsert_clip, get_connection, remove_game, init_db
    # Initialize cloud database tables on startup
    try:
        init_db()
        print("✅ Cloud database initialized")
    except Exception as e:
        print(f"⚠️  Database initialization error: {e}")
else:
    print("💻 Running in LOCAL mode - using SQLite")
    from analytics_db import fetch_clips, fetch_clip, upsert_clip, get_connection, remove_game

# Try to import semantic search - graceful fallback if not available
try:
    from semantic_search import semantic_search, rebuild_embeddings, OPENAI_AVAILABLE
    SEMANTIC_SEARCH_AVAILABLE = True
except ImportError:
    SEMANTIC_SEARCH_AVAILABLE = False
    OPENAI_AVAILABLE = False
    print("⚠️  Semantic search not available. Install: pip install openai numpy")

app = Flask(__name__)
CORS(app)

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent
BASE_DIR = PROJECT_ROOT
CLIPS_DIR = PROJECT_ROOT / "Clips"
METADATA_FILE = CLIPS_DIR / "clips_metadata.json"
BRIDGE_CTRL_BASE = "http://127.0.0.1:5000"
BRIDGE_APP_BASE = "http://127.0.0.1:5001"


def parse_actions(raw):
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return []
    if isinstance(raw, list):
        normalized = []
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            normalized.append({
                'phase': entry.get('phase', ''),
                'type': entry.get('type', ''),
                'coverage': entry.get('coverage', ''),
                'help': entry.get('help', ''),
                'breakdown': entry.get('breakdown', ''),
                'communication': entry.get('communication', ''),
            })
        return normalized
    return []

def derive_video_url(filename, fallback=None):
    for raw in (filename, fallback):
        if not raw:
            continue
        name = Path(raw).name
        clip_path = CLIPS_DIR / name
        if clip_path.exists():
            return f"/legacy/Clips/{name}"
    return None

@app.route('/')
def index():
    """Serve React app"""
    ui_dist = PROJECT_ROOT / 'ui' / 'dist'
    if ui_dist.exists() and (ui_dist / 'index.html').exists():
        return send_from_directory(ui_dist, 'index.html')
    else:
        return jsonify({'error': 'React app not built yet. Run: cd ui && npm run build'}), 404

@app.route('/<path:path>')
def serve_react_app(path):
    """Serve React app static files"""
    ui_dist = PROJECT_ROOT / 'ui' / 'dist'
    file_path = ui_dist / path
    if file_path.exists() and file_path.is_file():
        return send_from_directory(ui_dist, path)
    # For client-side routing, return index.html
    elif (ui_dist / 'index.html').exists():
        return send_from_directory(ui_dist, 'index.html')
    return jsonify({'error': 'File not found'}), 404

@app.route('/clip_detail.html')
def clip_detail():
    """Serve the clip detail page"""
    return send_from_directory(BASE_DIR, 'clip_detail.html')

@app.route('/clips/<path:filename>')
@app.route('/legacy/Clips/<path:filename>')
@require_auth
def serve_clip(filename):
    """Serve video clip files with proper headers for streaming"""
    full_path = CLIPS_DIR / filename
    if not full_path.exists():
        return jsonify({'error': f'Clip not found: {filename}'}), 404

    response = send_from_directory(CLIPS_DIR, filename, as_attachment=False)
    response.headers['Accept-Ranges'] = 'bytes'
    response.headers['Cache-Control'] = 'no-cache'
    return response

@app.route('/api/clips', methods=['GET', 'POST'])
@require_auth
def api_clips():
    """Get all clips or add a new clip"""
    try:
        # ---- POST: Add a new clip ----
        if request.method == 'POST':
            # Check write access for guest users
            user = getattr(request, 'user', None)
            if user and user.get('role') == 'guest':
                return jsonify({'error': 'Write access not allowed for guest users'}), 403
            new_clip = request.get_json()
            actions_payload = new_clip.get('actions')
            if actions_payload is not None and not isinstance(actions_payload, str):
                try:
                    new_clip['actions_json'] = json.dumps(actions_payload)
                except (TypeError, ValueError):
                    new_clip['actions_json'] = json.dumps([])
            elif 'actions_json' not in new_clip:
                new_clip['actions_json'] = json.dumps([])

            # Debug: log the fields we care about to a file
            with open('/tmp/backend_debug.log', 'a') as f:
                f.write(f"🐛 Received clip data - location: {new_clip.get('location')}, game_score: {new_clip.get('game_score')}\n")
                f.write(f"   Full clip keys: {list(new_clip.keys())}\n")

            print(f"🐛 Received clip data - location: {new_clip.get('location')}, game_score: {new_clip.get('game_score')}, formation: {new_clip.get('formation')}, coverage: {new_clip.get('coverage')}, ball_screen: {new_clip.get('ball_screen')}, off_ball_screen: {new_clip.get('off_ball_screen')}, disruption: {new_clip.get('disruption')}", flush=True)

            # Save to SQLite database
            try:
                upsert_clip(new_clip)
                print(f"✅ Added clip to SQLite: {new_clip.get('id', 'unknown')}")
            except Exception as e:
                print(f"⚠️  Failed to save to SQLite: {e}")

            # Also save to metadata file as backup (local mode only)
            if is_local():
                if METADATA_FILE.exists():
                    with open(METADATA_FILE, 'r') as f:
                        data = json.load(f)
                else:
                    data = {"clips": []}

                # Append the new clip
                data.setdefault("clips", []).append(new_clip)

                # Save back to file
                with open(METADATA_FILE, 'w') as f:
                    json.dump(data, f, indent=2)

                print(f"✅ Added clip: {new_clip.get('id', 'unknown')} to metadata file")
            return jsonify({"ok": True, "message": "Clip added", "clip": transform_db_clip(new_clip)}), 201

        # ---- GET: Return all clips ----
        db_clips = fetch_clips()
        if db_clips:
            transformed = [transform_db_clip(clip) for clip in db_clips]
            return jsonify(transformed)

        # Fallback to metadata file (local mode only)
        if is_local() and METADATA_FILE.exists():
            with open(METADATA_FILE, 'r') as f:
                data = json.load(f)
            clips = data.get('clips', [])
            transformed = [transform_clip(clip) for clip in clips]
            return jsonify(transformed)

        return jsonify([])

    except Exception as e:
        print("❌ Error in /api/clips:", e)
        return jsonify({"error": str(e)}), 500

def update_metadata_clip(clip_id: str, updates: dict):
    # Only update metadata file in local mode
    if not is_local():
        return

    if not METADATA_FILE.exists():
        return

    try:
        with open(METADATA_FILE, 'r') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return

    clips = data.get('clips', [])
    updated = False

    mapping = {
        'notes': 'Notes',
        'result': 'Play Result',
        'shooter': 'Shooter Designation',
        'play_trigger': 'Play Trigger',
        'action_trigger': 'Play Trigger',
        'has_shot': 'Has Shot',
        'shot_x': 'Shot X',
        'shot_y': 'Shot Y',
        'shot_result': 'Shot Result',
        'start_time': 'Start Time',
        'end_time': 'End Time',
        'video_start': 'video_start',
        'video_end': 'video_end',
    }

    for entry in clips:
        if entry.get('id') == clip_id:
            for key, value in updates.items():
                mapped = mapping.get(key)
                if mapped:
                    entry[mapped] = value
            updated = True
            break

    if updated:
        try:
            with open(METADATA_FILE, 'w') as f:
                json.dump(data, f, indent=2)
        except OSError:
            pass


def load_metadata_clip(clip_id: str):
    # Only use metadata file in local mode
    if not is_local():
        return None

    if not METADATA_FILE.exists():
        return None
    try:
        with open(METADATA_FILE, 'r') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
    for entry in data.get('clips', []):
        if entry.get('id') == clip_id:
            return entry
    return None


def remove_game_from_metadata(game_identifier, canonical_game_id=None):
    # Only use metadata file in local mode
    if not is_local():
        return 0

    if not METADATA_FILE.exists():
        return 0

    def _normalize(value):
        if value is None:
            return None
        stringified = str(value).strip()
        return stringified or None

    target_game_id = _normalize(game_identifier)
    target_canonical_id = _normalize(canonical_game_id)

    try:
        with open(METADATA_FILE, 'r') as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return 0

    clips = data.get('clips', [])

    def matches(entry: dict) -> bool:
        entry_game_values = [
            entry.get('game_id'),
            entry.get('gameId'),
            entry.get('Game #'),
            entry.get('game_num'),
            entry.get('gameNumber'),
        ]
        entry_canonical_values = [
            entry.get('canonical_game_id'),
            entry.get('canonicalGameId'),
            entry.get('__gameId'),
        ]
        normalized_game_values = {_normalize(value) for value in entry_game_values if _normalize(value)}
        normalized_canonical_values = {_normalize(value) for value in entry_canonical_values if _normalize(value)}

        if target_game_id and target_game_id in normalized_game_values:
            return True
        if target_canonical_id and target_canonical_id in normalized_canonical_values:
            return True
        return False

    filtered = [entry for entry in clips if not matches(entry)]
    removed = len(clips) - len(filtered)

    if removed > 0:
        data['clips'] = filtered
        try:
            with open(METADATA_FILE, 'w') as f:
                json.dump(data, f, indent=2)
        except OSError:
            pass

    return removed


@app.route('/api/clip/<clip_id>', methods=['GET', 'PUT', 'DELETE'])
@require_auth
def api_clip_detail(clip_id):
    """Get, update, or delete single clip metadata"""
    if request.method == 'GET':
        try:
            db_record = fetch_clip(clip_id)
            if db_record:
                return jsonify(transform_db_clip(db_record))

            # Fallback to metadata file (local mode only)
            if is_local() and METADATA_FILE.exists():
                with open(METADATA_FILE, 'r') as f:
                    data = json.load(f)
                clips = data.get('clips', [])
                for clip in clips:
                    if clip.get('id') == clip_id:
                        return jsonify(transform_clip(clip))

            return jsonify({"error": "Clip not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # DELETE clip
    if request.method == 'DELETE':
        # Only admin can delete - coaches must use delete requests
        user = getattr(request, 'user', None)
        if user and user.get('role') != 'admin':
            return jsonify({'error': 'Only admin can delete clips. Coaches should use delete requests.'}), 403
        try:
            print(f"[DEBUG] Attempting to delete clip: {clip_id}")
            # Delete from database if exists
            db_record = fetch_clip(clip_id)
            print(f"[DEBUG] DB record found: {db_record is not None}")
            if db_record:
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('DELETE FROM clips WHERE id = ?', (clip_id,))
                conn.commit()
                conn.close()
                print(f"[DEBUG] Deleted from database")

            # Delete from metadata file if exists (local mode only)
            if is_local() and METADATA_FILE.exists():
                print(f"[DEBUG] Metadata file exists: {METADATA_FILE}")
                with open(METADATA_FILE, 'r') as f:
                    data = json.load(f)
                clips = data.get('clips', [])
                print(f"[DEBUG] Found {len(clips)} clips in metadata")
                data['clips'] = [c for c in clips if c.get('id') != clip_id]
                print(f"[DEBUG] After filter: {len(data['clips'])} clips remaining")
                with open(METADATA_FILE, 'w') as f:
                    json.dump(data, f, indent=2)
                print(f"[DEBUG] Metadata file updated")

            print(f"[DEBUG] Delete successful")
            return jsonify({"ok": True, "message": "Clip deleted successfully"})
        except Exception as e:
            print(f"[ERROR] Delete failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    # PUT update
    if request.method == 'PUT':
        # Check write access for guest users
        user = getattr(request, 'user', None)
        if user and user.get('role') == 'guest':
            return jsonify({'error': 'Write access not allowed for guest users'}), 403
        try:
            payload = request.get_json(force=True) or {}
            print(f"[DEBUG] Received PUT payload for clip {clip_id}: {payload}")
            updates = {}

            # Map all possible fields
            field_mapping = {
                'game_id': 'gameId',
                'location': 'location',
                'opponent': 'opponent',
                'result': 'result',
                'notes': 'notes',
                'shooter': 'shooter',
                'quarter': 'quarter',
                'possession': 'possession',
                'situation': 'situation',
                'formation': 'formation',
                'play_name': 'play_name',
                'scout_coverage': 'scout_coverage',
                'play_trigger': 'play_trigger',
                'action_trigger': 'play_trigger',  # backward compatibility
                'action_types': 'action_types',
                'action_sequence': 'action_sequence',
                'coverage': 'coverage',
                'ball_screen': 'ball_screen',
                'off_ball_screen': 'off_ball_screen',
                'help_rotation': 'help_rotation',
                'disruption': 'disruption',
                'breakdown': 'breakdown',
                'play_type': 'play_type',
                'possession_result': 'possession_result',
                'defender_designation': 'defender_designation',
                'paint_touches': 'paint_touches',
                'shot_location': 'shot_location',
                'shot_contest': 'shot_contest',
                'shot_result': 'shot_result',
                'shot_quality': 'shot_quality',
                'rebound': 'rebound',
                'points': 'points',
            }

            for api_field, db_field in field_mapping.items():
                if api_field in payload:
                    value = payload.get(api_field)
                    updates[db_field] = value if value is not None else ''

            print(f"[DEBUG] Mapped updates: {updates}")

            if not updates:
                return jsonify({"error": "No valid fields provided"}), 400

            db_record = fetch_clip(clip_id)
            merged = {**(db_record or {}), **updates, 'id': clip_id}

            if db_record:
                upsert_clip(merged)
            update_metadata_clip(clip_id, updates)

            refreshed_db = fetch_clip(clip_id)
            if refreshed_db:
                return jsonify({"ok": True, "clip": transform_db_clip(refreshed_db)})

            refreshed_meta = load_metadata_clip(clip_id)
            if refreshed_meta:
                return jsonify({"ok": True, "clip": transform_clip(refreshed_meta)})

            return jsonify({"ok": True, "clip": {"id": clip_id, **updates}})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

def transform_clip(clip):
    """Transform clip field names to match HTML expectations"""
    location_code = (clip.get('location_code') or clip.get('locationCode') or clip.get('location') or
                     clip.get('Location Code') or clip.get('game_location') or clip.get('gameLocation') or '')
    location_display = (clip.get('location_display') or clip.get('locationDisplay') or clip.get('Location') or
                        clip.get('location_label') or clip.get('locationLabel') or clip.get('Game Location') or '')
    return {
        'id': clip.get('id'),
        'filename': clip.get('filename'),
        'video_url': clip.get('video_url') or derive_video_url(clip.get('filename'), clip.get('path') or clip.get('video_path')),
        'game_num': clip.get('gameId'),
        'opponent': clip.get('opponent'),
        'quarter': clip.get('quarter'),
        'possession': clip.get('possession'),
        'situation': clip.get('situation'),
        'offensive_formation': clip.get('formation'),
        'play_name': clip.get('playName'),
        'scout_coverage': clip.get('scoutCoverage'),
        'play_trigger': clip.get('playTrigger')
        or clip.get('Play Trigger')
        or clip.get('actionTrigger')
        or clip.get('Action Trigger'),
        'action_types': clip.get('actionTypes'),
        'action_sequence': clip.get('actionSequence'),
        'defensive_coverage': clip.get('coverage'),
        'ball_screen_coverage': clip.get('ballScreen'),
        'offball_screen_coverage': clip.get('offBallScreen'),
        'help_rotation': clip.get('helpRotation'),
        'defensive_disruption': clip.get('disruption'),
        'defensive_breakdown': clip.get('breakdown'),
        'play_result': clip.get('result'),
        'paint_touches': clip.get('paintTouch'),
        'shooter_designation': clip.get('shooter'),
        'shot_location': clip.get('shotLocation'),
        'shot_contest': clip.get('contest'),
        'rebound_outcome': clip.get('rebound'),
        'points': clip.get('points'),
        'has_shot': clip.get('hasShot'),
        'shot_x': clip.get('shotX'),
        'shot_y': clip.get('shotY'),
        'shot_result': clip.get('shotResult'),
        'notes': clip.get('notes'),
        'start_time': clip.get('startTime'),
        'end_time': clip.get('End Time') if clip.get('End Time') else clip.get('endTime'),
        'location': location_code,
        'location_display': location_display,
        'location_code': location_code,
        'game_location': location_code,
        'locationLabel': location_display,
        'actions': parse_actions(clip.get('actions') or clip.get('actions_json')),
    }


def transform_db_clip(clip):
    location_code = (
        clip.get('location_code') or clip.get('location') or clip.get('game_location') or
        clip.get('locationCode') or clip.get('Location Code') or ''
    )
    location_display = (
        clip.get('location_display') or clip.get('location') or clip.get('locationLabel') or
        clip.get('locationDisplay') or clip.get('Location') or ''
    )
    return {
        'id': clip.get('id'),
        'filename': clip.get('filename'),
        'source_video': clip.get('source_video'),
        'path': clip.get('path'),
        'video_url': derive_video_url(clip.get('filename'), clip.get('path')),
        'game_id': clip.get('game_id'),
        'opponent': clip.get('opponent'),
        'game_score': clip.get('game_score'),
        'quarter': clip.get('quarter'),
        'possession': clip.get('possession'),
        'situation': clip.get('situation'),
        'formation': clip.get('formation'),
        'play_name': clip.get('play_name'),
        'scout_coverage': clip.get('scout_coverage'),
        'play_trigger': clip.get('play_trigger') or clip.get('action_trigger'),
        'action_types': clip.get('action_types'),
        'action_sequence': clip.get('action_sequence'),
        'coverage': clip.get('coverage'),
        'ball_screen': clip.get('ball_screen'),
        'off_ball_screen': clip.get('off_ball_screen'),
        'help_rotation': clip.get('help_rotation'),
        'disruption': clip.get('disruption'),
        'breakdown': clip.get('breakdown'),
        'result': clip.get('result'),
        'paint_touch': clip.get('paint_touch'),
        'shooter': clip.get('shooter'),
        'shot_location': clip.get('shot_location'),
        'contest': clip.get('contest'),
        'rebound': clip.get('rebound'),
        'points': clip.get('points'),
        'has_shot': clip.get('has_shot'),
        'shot_x': clip.get('shot_x'),
        'shot_y': clip.get('shot_y'),
        'shot_result': clip.get('shot_result'),
        'player_designation': clip.get('player_designation'),
        'notes': clip.get('notes'),
        'start_time': clip.get('start_time'),
        'end_time': clip.get('end_time'),
        'location': location_code,
        'location_display': location_display,
        'location_code': location_code,
        'game_location': location_code,
        'locationLabel': location_display,
        'actions': parse_actions(clip.get('actions') or clip.get('actions_json')),
    }

@app.route('/api/clip/<clip_id>/shot', methods=['PUT', 'DELETE', 'OPTIONS'])
@require_auth
def update_clip_shot(clip_id):
    """Update or delete shot data for a clip"""
    if request.method == 'OPTIONS':
        return jsonify({"ok": True})

    # Check write access for guest users
    user = getattr(request, 'user', None)
    if user and user.get('role') == 'guest':
        return jsonify({'error': 'Write access not allowed for guest users'}), 403

    try:
        from analytics_db import get_connection

        if request.method == 'PUT':
            # Update shot data
            data = request.get_json()
            has_shot = data.get('has_shot', 'Yes')
            shot_x = data.get('shot_x', '')
            shot_y = data.get('shot_y', '')
            shot_result = data.get('shot_result', '')
            shooter_designation = data.get('shooter_designation', '')

            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE clips
                SET has_shot = ?, shot_x = ?, shot_y = ?, shot_result = ?, shooter = ?
                WHERE id = ?
            """, (has_shot, shot_x, shot_y, shot_result, shooter_designation, clip_id))
            conn.commit()
            conn.close()

            update_metadata_clip(clip_id, {
                'has_shot': has_shot,
                'shot_x': shot_x,
                'shot_y': shot_y,
                'shot_result': shot_result,
                'shooter': shooter_designation,
            })

            refreshed_db = fetch_clip(clip_id)
            if refreshed_db:
                return jsonify({"ok": True, "clip": transform_db_clip(refreshed_db)})

            refreshed_meta = load_metadata_clip(clip_id)
            if refreshed_meta:
                return jsonify({"ok": True, "clip": transform_clip(refreshed_meta)})

            return jsonify({
                "ok": True,
                "clip": {
                    'id': clip_id,
                    'has_shot': has_shot,
                    'shot_x': shot_x,
                    'shot_y': shot_y,
                    'shot_result': shot_result,
                }
            })

        elif request.method == 'DELETE':
            # Delete shot data
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE clips
                SET has_shot = 'No', shot_x = NULL, shot_y = NULL, shot_result = NULL
                WHERE id = ?
            """, (clip_id,))
            conn.commit()
            conn.close()

            update_metadata_clip(clip_id, {
                'has_shot': 'No',
                'shot_x': '',
                'shot_y': '',
                'shot_result': '',
            })

            refreshed_db = fetch_clip(clip_id)
            if refreshed_db:
                return jsonify({"ok": True, "clip": transform_db_clip(refreshed_db)})

            refreshed_meta = load_metadata_clip(clip_id)
            if refreshed_meta:
                return jsonify({"ok": True, "clip": transform_clip(refreshed_meta)})

            return jsonify({"ok": True, "clip": {'id': clip_id, 'has_shot': 'No'}})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/games/<game_id>', methods=['DELETE'])
@require_admin
def api_delete_game(game_id: str):
    """Delete all clips associated with a specific game. Admin only."""
    canonical_id = request.args.get('canonical_id')
    normalized_game_id = (game_id or '').strip()
    if not normalized_game_id and not canonical_id:
        return jsonify({"error": "A game_id or canonical_id is required"}), 400
    try:
        deleted_from_db = remove_game(normalized_game_id or None, canonical_id)
        deleted_from_meta = remove_game_from_metadata(normalized_game_id or None, canonical_id)
        return jsonify({
            "ok": True,
            "deleted": deleted_from_db,
            "metadata_deleted": deleted_from_meta,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "clips_dir": str(CLIPS_DIR),
        "clips_exist": CLIPS_DIR.exists()
    })


def bridge_ctrl_request(method: str, endpoint: str, **kwargs):
    try:
        response = requests.request(method, f"{BRIDGE_CTRL_BASE}{endpoint}", timeout=2, **kwargs)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise RuntimeError(str(exc))


def bridge_excel_request(method: str, endpoint: str, **kwargs):
    try:
        response = requests.request(method, f"{BRIDGE_APP_BASE}{endpoint}", timeout=3, **kwargs)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise RuntimeError(str(exc))


@app.route('/excel/status')
@require_auth
def excel_status():
    controller = None
    workbook = None
    try:
        controller = bridge_ctrl_request('GET', '/status')
    except RuntimeError as exc:
        controller = {'ok': False, 'error': str(exc)}

    try:
        workbook = bridge_excel_request('GET', '/health')
    except RuntimeError as exc:
        workbook = {'ok': False, 'error': str(exc)}

    return jsonify({'ok': True, 'controller': controller, 'workbook': workbook})


@app.route('/excel/start', methods=['POST'])
@require_write
def excel_start():
    try:
        data = bridge_ctrl_request('POST', '/start')
        return jsonify({'ok': True, 'status': data})
    except RuntimeError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 502


@app.route('/excel/stop', methods=['POST'])
@require_write
def excel_stop():
    try:
        data = bridge_ctrl_request('POST', '/stop')
        return jsonify({'ok': True, 'status': data})
    except RuntimeError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 502


@app.route('/excel/check-row')
@require_auth
def excel_check_row():
    try:
        row = request.args.get('row', type=int) or 2
        data = bridge_excel_request('GET', '/check_row', params={'row': row})
        return jsonify({'ok': True, 'status': data})
    except RuntimeError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 502


@app.route('/excel/append', methods=['POST'])
@require_write
def excel_append():
    try:
        payload = request.get_json(force=True) or {}
        data = bridge_excel_request('POST', '/append', json=payload)
        return jsonify({'ok': True, 'status': data})
    except RuntimeError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 502


@app.route('/api/search/semantic', methods=['POST'])
@require_auth
def api_semantic_search():
    """
    AI-powered semantic search endpoint.
    POST body: {"query": "find all Horns actions with drop coverage", "top_k": 20}
    """
    if not SEMANTIC_SEARCH_AVAILABLE:
        return jsonify({
            "error": "Semantic search not available. Install: pip install openai numpy",
            "available": False
        }), 501

    if not OPENAI_AVAILABLE:
        return jsonify({
            "error": "OpenAI library not available",
            "available": False
        }), 501

    try:
        data = request.get_json(force=True) or {}
        query = data.get('query', '').strip()
        top_k = data.get('top_k', 20)

        if not query:
            return jsonify({"error": "Query parameter required"}), 400

        results = semantic_search(query, top_k=top_k)

        # Transform results to match frontend expectations
        transformed = [transform_db_clip(clip) for clip in results]

        return jsonify({
            "ok": True,
            "query": query,
            "count": len(transformed),
            "results": transformed
        })

    except ValueError as e:
        return jsonify({"error": str(e), "available": False}), 400
    except Exception as e:
        print(f"❌ Semantic search error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/search/rebuild-embeddings', methods=['POST'])
@require_write
def api_rebuild_embeddings():
    """
    Rebuild all clip embeddings. Call this when clips are added/updated.
    """
    if not SEMANTIC_SEARCH_AVAILABLE:
        return jsonify({
            "error": "Semantic search not available",
            "available": False
        }), 501

    try:
        result = rebuild_embeddings()
        if result['success']:
            return jsonify({"ok": True, **result})
        else:
            return jsonify({"ok": False, **result}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route('/api/search/status')
def api_search_status():
    """Check if semantic search is available."""
    import os
    return jsonify({
        "semantic_search_available": SEMANTIC_SEARCH_AVAILABLE,
        "openai_available": OPENAI_AVAILABLE,
        "api_key_set": bool(os.environ.get('OPENAI_API_KEY'))
    })


@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """Login endpoint - returns JWT token"""
    try:
        # Import auth module
        from auth import authenticate_user, create_jwt_token

        # Debug logging
        print(f"📥 Login request - Content-Type: {request.content_type}")
        print(f"📥 Login request - Data: {request.data}")

        data = request.get_json(force=True, silent=True)
        if not data:
            print(f"❌ Failed to parse JSON from request")
            return jsonify({'error': 'No JSON data provided'}), 400

        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        # Authenticate user
        print(f"🔍 Attempting login for username: '{username}'")
        user = authenticate_user(username, password)

        if not user:
            print(f"❌ Authentication failed for username: '{username}'")
            return jsonify({'error': 'Invalid credentials'}), 401

        print(f"✅ Authentication successful for: '{username}' (role: {user.get('role')})")

        # Create JWT token
        token = create_jwt_token(user['username'], user['role'])

        return jsonify({
            'token': token,
            'username': user['username'],
            'role': user['role']
        })

    except Exception as e:
        import traceback
        print(f"❌ Login error: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Login failed', 'details': str(e)}), 500


@app.route('/api/deploy', methods=['POST'])
def api_deploy():
    """Deploy code changes to cloud - only works in local mode"""
    import subprocess
    import os

    # Only allow in local mode
    if is_cloud():
        return jsonify({'error': 'Deploy endpoint only available in local mode'}), 403

    try:
        steps = []

        # Step 1: Sync database to cloud
        steps.append({'step': 'db_sync', 'status': 'running', 'message': 'Syncing database to cloud...'})
        print("☁️  Syncing database to cloud...")

        try:
            # Direct connection to cloud PostgreSQL
            import psycopg
            from psycopg.rows import dict_row

            cloud_db_url = 'postgresql://ou_basketball_db_user:1mKo7AhmuSe8fH3wJBXH7Sonp0MV6riw@dpg-d4iknhur433s73a38t10-a.oregon-postgres.render.com/ou_basketball_db?sslmode=require'

            # Fetch all clips from local database
            local_clips = fetch_clips()

            if local_clips and len(local_clips) > 0:
                print(f"📊 Found {len(local_clips)} clips to sync")

                # Connect to cloud database and push each clip
                conn = psycopg.connect(cloud_db_url, row_factory=dict_row, autocommit=False)
                cur = conn.cursor()

                for clip in local_clips:
                    # Prepare clip data mapped to cloud database schema (sync ALL fields)
                    import json
                    clip_data = {
                        'id': clip.get('id'),
                        'filename': clip.get('filename'),
                        'path': clip.get('path'),
                        'source_video': clip.get('source_video'),
                        'game_id': clip.get('game_id'),
                        'canonical_game_id': clip.get('canonical_game_id'),
                        'canonical_clip_id': clip.get('canonical_clip_id'),
                        'opponent': clip.get('opponent'),
                        'opponent_slug': clip.get('opponent_slug'),
                        'location': clip.get('location'),
                        'game_score': clip.get('game_score'),
                        'quarter': clip.get('quarter'),
                        'possession': clip.get('possession'),
                        'situation': clip.get('situation'),
                        'formation': clip.get('formation'),
                        'play_name': clip.get('play_name'),
                        'scout_coverage': clip.get('scout_coverage'),
                        'play_trigger': clip.get('play_trigger'),
                        'action_types': clip.get('action_types'),
                        'action_sequence': clip.get('action_sequence'),
                        'coverage': clip.get('coverage'),
                        'ball_screen': clip.get('ball_screen'),
                        'off_ball_screen': clip.get('off_ball_screen'),
                        'help_rotation': clip.get('help_rotation'),
                        'disruption': clip.get('disruption'),
                        'breakdown': clip.get('breakdown'),
                        'result': clip.get('result'),
                        'paint_touch': clip.get('paint_touch'),
                        'shooter': clip.get('shooter'),
                        'shot_location': clip.get('shot_location'),
                        'contest': clip.get('contest'),
                        'rebound': clip.get('rebound'),
                        'points': clip.get('points'),
                        'has_shot': clip.get('has_shot'),
                        'shot_x': clip.get('shot_x'),
                        'shot_y': clip.get('shot_y'),
                        'shot_result': clip.get('shot_result'),
                        'player_designation': clip.get('player_designation'),
                        'notes': clip.get('notes'),
                        'start_time': clip.get('start_time'),
                        'end_time': clip.get('end_time'),
                        'actions_json': clip.get('actions_json'),
                    }

                    # Insert or update clip in cloud database
                    cur.execute("""
                        INSERT INTO clips (
                            id, filename, path, source_video, game_id, canonical_game_id,
                            canonical_clip_id, opponent, opponent_slug, location, game_score,
                            quarter, possession, situation, formation, play_name,
                            scout_coverage, play_trigger, action_types, action_sequence,
                            coverage, ball_screen, off_ball_screen, help_rotation, disruption,
                            breakdown, result, paint_touch, shooter, shot_location, contest,
                            rebound, points, has_shot, shot_x, shot_y, shot_result,
                            player_designation, notes, start_time, end_time, actions_json
                        ) VALUES (
                            %(id)s, %(filename)s, %(path)s, %(source_video)s, %(game_id)s,
                            %(canonical_game_id)s, %(canonical_clip_id)s, %(opponent)s,
                            %(opponent_slug)s, %(location)s, %(game_score)s, %(quarter)s,
                            %(possession)s, %(situation)s, %(formation)s, %(play_name)s,
                            %(scout_coverage)s, %(play_trigger)s, %(action_types)s,
                            %(action_sequence)s, %(coverage)s, %(ball_screen)s,
                            %(off_ball_screen)s, %(help_rotation)s, %(disruption)s,
                            %(breakdown)s, %(result)s, %(paint_touch)s, %(shooter)s,
                            %(shot_location)s, %(contest)s, %(rebound)s, %(points)s,
                            %(has_shot)s, %(shot_x)s, %(shot_y)s, %(shot_result)s,
                            %(player_designation)s, %(notes)s, %(start_time)s, %(end_time)s,
                            %(actions_json)s
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            filename = EXCLUDED.filename,
                            path = EXCLUDED.path,
                            source_video = EXCLUDED.source_video,
                            game_id = EXCLUDED.game_id,
                            canonical_game_id = EXCLUDED.canonical_game_id,
                            canonical_clip_id = EXCLUDED.canonical_clip_id,
                            opponent = EXCLUDED.opponent,
                            opponent_slug = EXCLUDED.opponent_slug,
                            location = EXCLUDED.location,
                            game_score = EXCLUDED.game_score,
                            quarter = EXCLUDED.quarter,
                            possession = EXCLUDED.possession,
                            situation = EXCLUDED.situation,
                            formation = EXCLUDED.formation,
                            play_name = EXCLUDED.play_name,
                            scout_coverage = EXCLUDED.scout_coverage,
                            play_trigger = EXCLUDED.play_trigger,
                            action_types = EXCLUDED.action_types,
                            action_sequence = EXCLUDED.action_sequence,
                            coverage = EXCLUDED.coverage,
                            ball_screen = EXCLUDED.ball_screen,
                            off_ball_screen = EXCLUDED.off_ball_screen,
                            help_rotation = EXCLUDED.help_rotation,
                            disruption = EXCLUDED.disruption,
                            breakdown = EXCLUDED.breakdown,
                            result = EXCLUDED.result,
                            paint_touch = EXCLUDED.paint_touch,
                            shooter = EXCLUDED.shooter,
                            shot_location = EXCLUDED.shot_location,
                            contest = EXCLUDED.contest,
                            rebound = EXCLUDED.rebound,
                            points = EXCLUDED.points,
                            has_shot = EXCLUDED.has_shot,
                            shot_x = EXCLUDED.shot_x,
                            shot_y = EXCLUDED.shot_y,
                            shot_result = EXCLUDED.shot_result,
                            player_designation = EXCLUDED.player_designation,
                            notes = EXCLUDED.notes,
                            start_time = EXCLUDED.start_time,
                            end_time = EXCLUDED.end_time,
                            actions_json = EXCLUDED.actions_json
                    """, clip_data)

                conn.commit()
                cur.close()
                conn.close()

                steps[-1] = {'step': 'db_sync', 'status': 'success', 'message': f'Synced {len(local_clips)} clips to cloud'}
                print(f"✅ Synced {len(local_clips)} clips to cloud")
            else:
                steps[-1] = {'step': 'db_sync', 'status': 'skipped', 'message': 'No clips to sync'}
                print("⚠️  No clips found to sync")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"⚠️  Database sync failed: {e}")
            steps[-1] = {'step': 'db_sync', 'status': 'failed', 'message': f'Database sync failed: {str(e)}'}
            # Continue with deployment even if sync fails

        # Step 2: Build React app
        steps.append({'step': 'build', 'status': 'running', 'message': 'Building React app...'})
        print("📦 Building React app...")

        ui_dir = PROJECT_ROOT / 'ui'
        build_result = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=ui_dir,
            capture_output=True,
            text=True,
            timeout=120
        )

        if build_result.returncode != 0:
            return jsonify({
                'error': 'Build failed',
                'details': build_result.stderr,
                'steps': steps
            }), 500

        steps[-1] = {'step': 'build', 'status': 'success', 'message': 'React app built successfully'}

        # Step 2: Git add
        steps.append({'step': 'git_add', 'status': 'running', 'message': 'Staging changes...'})
        print("📝 Staging git changes...")

        git_add_result = subprocess.run(
            ['git', 'add', '-A'],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=30
        )

        if git_add_result.returncode != 0:
            return jsonify({
                'error': 'Git add failed',
                'details': git_add_result.stderr,
                'steps': steps
            }), 500

        steps[-1] = {'step': 'git_add', 'status': 'success', 'message': 'Changes staged'}

        # Step 3: Git commit
        steps.append({'step': 'git_commit', 'status': 'running', 'message': 'Committing changes...'})
        print("💾 Committing changes...")

        commit_message = """Auto-deploy: Sync database and code changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"""

        git_commit_result = subprocess.run(
            ['git', 'commit', '-m', commit_message],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=30
        )

        # Check if there's nothing to commit
        if 'nothing to commit' in git_commit_result.stdout.lower():
            steps[-1] = {'step': 'git_commit', 'status': 'skipped', 'message': 'No code changes to commit'}
        elif git_commit_result.returncode != 0:
            return jsonify({
                'error': 'Git commit failed',
                'details': git_commit_result.stderr,
                'steps': steps
            }), 500
        else:
            steps[-1] = {'step': 'git_commit', 'status': 'success', 'message': 'Changes committed'}

        # Step 4: Git push
        steps.append({'step': 'git_push', 'status': 'running', 'message': 'Pushing to GitHub...'})
        print("🚀 Pushing to GitHub...")

        git_push_result = subprocess.run(
            ['git', 'push'],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=60
        )

        if git_push_result.returncode != 0:
            # Check if it's because there's nothing to push
            if 'Everything up-to-date' in git_push_result.stderr or 'Everything up-to-date' in git_push_result.stdout:
                steps[-1] = {'step': 'git_push', 'status': 'skipped', 'message': 'Already up-to-date'}
            else:
                return jsonify({
                    'error': 'Git push failed',
                    'details': git_push_result.stderr,
                    'steps': steps
                }), 500
        else:
            steps[-1] = {'step': 'git_push', 'status': 'success', 'message': 'Pushed to GitHub - Render will auto-deploy'}

        print("✅ Deploy complete!")

        return jsonify({
            'success': True,
            'message': 'Deploy successful - Render will rebuild in 2-3 minutes',
            'steps': steps
        })

    except subprocess.TimeoutExpired as e:
        return jsonify({
            'error': f'Timeout during {e.cmd}',
            'details': str(e)
        }), 500
    except Exception as e:
        import traceback
        print(f"❌ Deploy error: {e}")
        traceback.print_exc()
        return jsonify({
            'error': 'Deploy failed',
            'details': str(e)
        }), 500


if __name__ == '__main__':
    # Create clips directory if it doesn't exist
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n🎬 Media Server Starting...")
    print(f"📁 Serving clips from: {CLIPS_DIR}")
    print(f"🌐 Server running at: http://127.0.0.1:8000")
    print(f"✋ Press Ctrl+C to stop\n")

    app.run(host='127.0.0.1', port=8000, debug=False)
