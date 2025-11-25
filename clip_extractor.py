from flask import Flask, request, jsonify
import subprocess
import os
from pathlib import Path
import json
import datetime
import re

from analytics_db import upsert_clip

app = Flask(__name__)

# Configure CORS
@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET"
    return resp

# Directories
PROJECT_ROOT = Path(__file__).resolve().parent
BASE_DIR = PROJECT_ROOT
CLIPS_DIR = BASE_DIR / "Clips"
METADATA_FILE = CLIPS_DIR / "clips_metadata.json"

# Ensure directories exist
CLIPS_DIR.mkdir(exist_ok=True)

# Store current video path
current_video_path = None

def time_to_seconds(time_str):
    """Convert HH:MM:SS or MM:SS to total seconds"""
    parts = time_str.strip().split(':')
    try:
        if len(parts) == 3:
            h, m, s = map(int, parts)
            return h * 3600 + m * 60 + s
        elif len(parts) == 2:
            m, s = map(int, parts)
            return m * 60 + s
        else:
            return int(parts[0])
    except:
        return 0

def load_metadata():
    """Load existing clips metadata"""
    if METADATA_FILE.exists():
        with open(METADATA_FILE, 'r') as f:
            return json.load(f)
    return {"clips": []}

def save_metadata(data):
    """Save clips metadata"""
    with open(METADATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def slugify(value, fallback='clip'):
    """Convert text to safe filename slug"""
    if not isinstance(value, str):
        value = str(value or '')
    slug = re.sub(r'[^a-z0-9]+', '_', value.lower()).strip('_')
    return slug or fallback

@app.route("/set_video", methods=["POST", "OPTIONS"])
def set_video():
    """Set the current video file path"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    try:
        data = request.get_json(force=True)
        global current_video_path
        video_path = data.get("video_path", "").strip()

        print(f"🔍 Looking for video: {video_path}")

        # If path exists as-is, use it
        if video_path and os.path.exists(video_path):
            current_video_path = video_path
            print(f"📹 Video set (direct): {current_video_path}")
            return jsonify({"ok": True, "video_path": current_video_path})

        # Otherwise try to find it by filename
        filename = video_path
        if not filename:
            filename = data.get("filename", "")

        # Remove any path prefix if it's there (get just the filename)
        if "/" in filename:
            filename = filename.split("/")[-1]
        elif "\\" in filename:
            filename = filename.split("\\")[-1]

        if filename:
            print(f"🔍 Searching for filename: {filename}")
            # Try looking in Clips folder first (where game videos are), then other locations
            possible_paths = [
                CLIPS_DIR / filename,
                BASE_DIR / filename,
                BASE_DIR / "Videos" / filename,
                Path.home() / "Downloads" / filename,
                Path.home() / "Desktop" / filename,
                Path.home() / "Desktop" / "Defense" / filename,
                Path.home() / "Desktop" / "Defense" / "Videos" / filename,
            ]

            for p in possible_paths:
                print(f"  Checking: {p}")
                if p.exists():
                    current_video_path = str(p)
                    print(f"📹 Video found: {current_video_path}")
                    return jsonify({"ok": True, "video_path": current_video_path})

        print(f"❌ Video not found: {video_path}")
        return jsonify({
            "ok": False,
            "error": f"Video file not found: {video_path}",
            "searched": str(CLIPS_DIR),
            "hint": "Make sure the video file is in the Clips folder"
        }), 400

    except Exception as e:
        print(f"❌ Error setting video: {str(e)}")
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/set_video_manual", methods=["POST", "OPTIONS"])
def set_video_manual():
    """Manually set video path from user input"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    try:
        data = request.get_json(force=True)
        global current_video_path
        video_path = data.get("video_path", "").strip()
        
        # Expand ~ to home directory
        if video_path.startswith("~"):
            video_path = str(Path.home() / video_path[2:])
        
        if not os.path.exists(video_path):
            return jsonify({"ok": False, "error": f"Video file not found at: {video_path}"}), 400
        
        current_video_path = video_path
        print(f"📹 Video manually set: {current_video_path}")
        return jsonify({"ok": True, "video_path": current_video_path})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/extract_clip", methods=["POST", "OPTIONS"])
def extract_clip():
    """Extract a video clip using FFmpeg"""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})
    
    try:
        data = request.get_json(force=True)
        
        # Get clip info
        start_time = data.get("Start Time", "")
        end_time = data.get("End Time", "")
        game_num = data.get("Game #", "1")
        quarter = data.get("Quarter", "1")
        possession = data.get("Possession #", "1")
        opponent_raw = data.get("Opponent", "Unknown")
        opponent_slug = slugify(opponent_raw, fallback='opponent')
        
        # Validate
        if not start_time or not end_time:
            return jsonify({"ok": False, "error": "Start and End times required"}), 400
            
        if not current_video_path or not os.path.exists(current_video_path):
            return jsonify({"ok": False, "error": "No video file loaded. Load a video first."}), 400
        
        # Convert times to seconds
        start_sec = time_to_seconds(start_time)
        end_sec = time_to_seconds(end_time)
        duration = end_sec - start_sec
        
        if duration <= 0:
            return jsonify({"ok": False, "error": "End time must be after start time"}), 400
        
        # Create filename
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"G{game_num}_Q{quarter}_P{possession}_{opponent_slug}_{timestamp}.mp4"
        output_path = CLIPS_DIR / filename
        
        # FFmpeg command to extract clip
        cmd = [
            "ffmpeg",
            "-ss", str(start_sec),           # Start time
            "-i", current_video_path,        # Input file
            "-t", str(duration),             # Duration
            "-c", "copy",                    # Copy codec (fast, no re-encoding)
            "-avoid_negative_ts", "1",       # Fix timestamp issues
            str(output_path)
        ]
        
        # Run FFmpeg
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return jsonify({"ok": False, "error": f"FFmpeg error: {result.stderr}"}), 500
        
        # Load existing metadata
        metadata = load_metadata()
        
        # Generate clip ID (prefer canonical from client if present)
        canonical_from_client = data.get("__clipId")
        clip_id = canonical_from_client or f"clip_{timestamp}_{game_num}_{quarter}_{possession}"
        
        # Add clip data
        clip_data = {
            "id": clip_id,
            "filename": filename,
            "path": str(output_path),
            "gameId": int(game_num),
            "quarter": int(quarter),
            "possession": int(possession),
            "opponent": opponent_raw,
            "situation": data.get("Situation", ""),
            "formation": data.get("Offensive Formation", ""),
            "playName": data.get("Play Name", ""),
            "scoutCoverage": data.get("Covered in Scout?", ""),
            "playTrigger": data.get("Play Trigger") or data.get("Action Trigger", ""),
            "actionTypes": data.get("Action Type(s)", ""),
            "actionSequence": data.get("Action Sequence", ""),
            "coverage": data.get("Defensive Coverage", ""),
            "ballScreen": data.get("Ball Screen Coverage", ""),
            "offBallScreen": data.get("Off-Ball Screen Coverage", ""),
            "helpRotation": data.get("Help/Rotation", ""),
            "disruption": data.get("Defensive Disruption", ""),
            "breakdown": data.get("Defensive Breakdown", ""),
            "result": data.get("Play Result", ""),
            "paintTouch": data.get("Paint Touches", ""),
            "shooter": data.get("Shooter Designation", ""),
            "shotLocation": data.get("Shot Location", ""),
            "contest": data.get("Shot Contest", ""),
            "rebound": data.get("Rebound Outcome", ""),
            "points": int(data.get("Points", 0)),
            "hasShot": data.get("Has Shot", ""),
            "shotX": data.get("Shot X", ""),
            "shotY": data.get("Shot Y", ""),
            "shotResult": data.get("Shot Result", ""),
            "notes": data.get("Notes", ""),
            "startTime": start_time,
            "endTime": end_time,
            "createdAt": datetime.datetime.now().isoformat()
        }
        
        canonical_game_id = data.get("__gameId") or f"G{game_num}_{opponent_slug}"
        canonical_clip_id = data.get("__clipId") or clip_id
        opponent_norm = data.get("__opponent") or opponent_raw

        clip_data["opponent"] = opponent_norm
        clip_data["canonicalGameId"] = canonical_game_id
        clip_data["canonicalClipId"] = canonical_clip_id
        clip_data["__gameId"] = canonical_game_id
        clip_data["__clipId"] = canonical_clip_id
        clip_data["__opponent"] = opponent_norm
        metadata["clips"].append(clip_data)
        save_metadata(metadata)

        db_record = {
            "id": canonical_clip_id,
            "filename": filename,
            "path": str(output_path),
            "game_id": int(game_num),
            "canonical_game_id": canonical_game_id,
            "canonical_clip_id": canonical_clip_id,
            "opponent": opponent_norm,
            "opponent_slug": opponent_slug,
            "location": data.get("Location", ""),
            "game_score": data.get("Game Score", ""),
            "quarter": int(quarter),
            "possession": int(possession),
            "situation": data.get("Situation", ""),
            "formation": data.get("Offensive Formation", ""),
            "play_name": data.get("Play Name", ""),
            "scout_coverage": data.get("Covered in Scout?", ""),
            "play_trigger": data.get("Play Trigger") or data.get("Action Trigger", ""),
            "action_types": data.get("Action Type(s)", ""),
            "action_sequence": data.get("Action Sequence", ""),
            "coverage": data.get("Defensive Coverage", ""),
            "ball_screen": data.get("Ball Screen Coverage", ""),
            "off_ball_screen": data.get("Off-Ball Screen Coverage", ""),
            "help_rotation": data.get("Help/Rotation", ""),
            "disruption": data.get("Defensive Disruption", ""),
            "breakdown": data.get("Defensive Breakdown", ""),
            "result": data.get("Play Result", ""),
            "paint_touch": data.get("Paint Touches", ""),
            "shooter": data.get("Shooter Designation", ""),
            "shot_location": data.get("Shot Location", ""),
            "contest": data.get("Shot Contest", ""),
            "rebound": data.get("Rebound Outcome", ""),
            "points": int(data.get("Points", 0)),
            "has_shot": data.get("Has Shot", ""),
            "shot_x": data.get("Shot X", ""),
            "shot_y": data.get("Shot Y", ""),
            "shot_result": data.get("Shot Result", ""),
            "player_designation": data.get("player_designation", ""),
            "notes": data.get("Notes", ""),
            "start_time": start_time,
            "end_time": end_time,
            "created_at": clip_data["createdAt"],
        }
        upsert_clip(db_record)
        
        print(f"✅ Clip extracted: {filename}")
        return jsonify({"ok": True, "clip_id": clip_id, "filename": filename, "path": str(output_path)})
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/get_clips", methods=["GET"])
def get_clips():
    """Get all clips metadata"""
    try:
        metadata = load_metadata()
        return jsonify({"ok": True, "clips": metadata["clips"]})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "clips_dir": str(CLIPS_DIR),
        "video_loaded": current_video_path is not None,
        "current_video": current_video_path
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5002, debug=False)
