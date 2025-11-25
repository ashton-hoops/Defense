"""
AI Semantic Search for Basketball Clips
Uses OpenAI embeddings to enable natural language queries like:
"find all Horns actions with drop coverage that led to made 3s"
"""
import os
import json
import sqlite3
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional
from analytics_db import fetch_clips, DB_PATH, get_connection

# Try to import OpenAI - graceful fallback if not installed
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠️  OpenAI not installed. Run: pip install openai")

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDINGS_FILE = Path(__file__).resolve().parent / "data" / "clip_embeddings.json"

def get_clip_text_representation(clip: Dict[str, Any]) -> str:
    """
    Convert clip metadata into a rich text representation for embedding.
    Includes all relevant basketball terms, actions, and outcomes.
    """
    parts = []

    # Game context
    if clip.get('game_id'):
        parts.append(f"Game {clip['game_id']}")
    if clip.get('opponent'):
        parts.append(f"vs {clip['opponent']}")
    if clip.get('quarter'):
        parts.append(f"Q{clip['quarter']}")
    if clip.get('possession'):
        parts.append(f"Possession {clip['possession']}")

    # Situation and formation
    if clip.get('situation'):
        parts.append(f"Situation: {clip['situation']}")
    if clip.get('formation'):
        parts.append(f"Formation: {clip['formation']}")
    if clip.get('play_name'):
        parts.append(f"Play: {clip['play_name']}")

    # Actions
    trigger_value = clip.get('play_trigger') or clip.get('action_trigger')
    if trigger_value:
        parts.append(f"Trigger: {trigger_value}")
    if clip.get('action_types'):
        parts.append(f"Actions: {clip['action_types']}")
    if clip.get('action_sequence'):
        parts.append(f"Sequence: {clip['action_sequence']}")

    # Defense
    if clip.get('scout_coverage'):
        parts.append(f"Scout Coverage: {clip['scout_coverage']}")
    if clip.get('coverage'):
        parts.append(f"Coverage: {clip['coverage']}")
    if clip.get('ball_screen'):
        parts.append(f"Ball Screen: {clip['ball_screen']}")
    if clip.get('off_ball_screen'):
        parts.append(f"Off Ball Screen: {clip['off_ball_screen']}")
    if clip.get('help_rotation'):
        parts.append(f"Help: {clip['help_rotation']}")
    if clip.get('disruption'):
        parts.append(f"Disruption: {clip['disruption']}")
    if clip.get('breakdown'):
        parts.append(f"Breakdown: {clip['breakdown']}")

    # Result and outcome
    if clip.get('result'):
        parts.append(f"Result: {clip['result']}")
    if clip.get('shooter'):
        parts.append(f"Shooter: {clip['shooter']}")
    if clip.get('shot_location'):
        parts.append(f"Shot Location: {clip['shot_location']}")
    if clip.get('shot_result'):
        parts.append(f"Shot Result: {clip['shot_result']}")
    if clip.get('points'):
        parts.append(f"{clip['points']} points")
    if clip.get('rebound'):
        parts.append(f"Rebound: {clip['rebound']}")
    if clip.get('contest'):
        parts.append(f"Contest: {clip['contest']}")
    if clip.get('paint_touch'):
        parts.append(f"Paint Touch: {clip['paint_touch']}")

    # Notes
    if clip.get('notes'):
        parts.append(f"Notes: {clip['notes']}")

    return " | ".join(parts)


def generate_embeddings_for_all_clips() -> Dict[str, List[float]]:
    """
    Generate embeddings for all clips in the database.
    Returns dict mapping clip_id -> embedding vector.
    """
    if not OPENAI_AVAILABLE:
        raise ImportError("OpenAI library not available")

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    client = OpenAI(api_key=api_key)
    clips = fetch_clips()

    embeddings = {}
    texts_to_embed = []
    clip_ids = []

    print(f"🔄 Generating embeddings for {len(clips)} clips...")

    # Prepare batch of texts
    for clip in clips:
        clip_id = clip['id']
        text = get_clip_text_representation(clip)
        texts_to_embed.append(text)
        clip_ids.append(clip_id)

    # Generate embeddings in batch (more efficient)
    if texts_to_embed:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts_to_embed
        )

        for i, embedding_obj in enumerate(response.data):
            clip_id = clip_ids[i]
            embeddings[clip_id] = embedding_obj.embedding

    print(f"✅ Generated {len(embeddings)} embeddings")
    return embeddings


def save_embeddings(embeddings: Dict[str, List[float]]) -> None:
    """Save embeddings to disk as JSON."""
    EMBEDDINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(EMBEDDINGS_FILE, 'w') as f:
        json.dump(embeddings, f)
    print(f"💾 Saved embeddings to {EMBEDDINGS_FILE}")


def load_embeddings() -> Optional[Dict[str, List[float]]]:
    """Load embeddings from disk."""
    if not EMBEDDINGS_FILE.exists():
        return None
    with open(EMBEDDINGS_FILE, 'r') as f:
        return json.load(f)


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))


def semantic_search(query: str, top_k: int = 20) -> List[Dict[str, Any]]:
    """
    Search clips using natural language query.

    Args:
        query: Natural language search query (e.g., "Horns actions with drop coverage")
        top_k: Number of results to return

    Returns:
        List of clip dicts with similarity scores
    """
    if not OPENAI_AVAILABLE:
        raise ImportError("OpenAI library not available")

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    # Load embeddings
    embeddings = load_embeddings()
    if not embeddings:
        print("⚠️  No embeddings found. Generating now...")
        embeddings = generate_embeddings_for_all_clips()
        save_embeddings(embeddings)

    # Generate query embedding
    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=[query]
    )
    query_embedding = response.data[0].embedding

    # Calculate similarities
    similarities = []
    for clip_id, clip_embedding in embeddings.items():
        similarity = cosine_similarity(query_embedding, clip_embedding)
        similarities.append((clip_id, similarity))

    # Sort by similarity (highest first)
    similarities.sort(key=lambda x: x[1], reverse=True)
    top_results = similarities[:top_k]

    # Fetch full clip data
    clips = fetch_clips()
    clips_by_id = {clip['id']: clip for clip in clips}

    results = []
    for clip_id, similarity in top_results:
        if clip_id in clips_by_id:
            clip_data = clips_by_id[clip_id].copy()
            clip_data['similarity_score'] = float(similarity)
            results.append(clip_data)

    return results


def rebuild_embeddings() -> Dict[str, Any]:
    """
    Rebuild all embeddings from scratch.
    Useful when clips are added or metadata changes.
    """
    try:
        embeddings = generate_embeddings_for_all_clips()
        save_embeddings(embeddings)
        return {
            'success': True,
            'count': len(embeddings),
            'message': f'Successfully generated {len(embeddings)} embeddings'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


if __name__ == '__main__':
    # CLI for building embeddings
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == 'build':
        print("🚀 Building embeddings...")
        result = rebuild_embeddings()
        if result['success']:
            print(f"✅ {result['message']}")
        else:
            print(f"❌ Error: {result['error']}")
    elif len(sys.argv) > 1 and sys.argv[1] == 'search':
        query = ' '.join(sys.argv[2:])
        print(f"🔍 Searching for: {query}")
        results = semantic_search(query, top_k=5)
        print(f"\n📊 Top {len(results)} results:")
        for i, clip in enumerate(results, 1):
            score = clip.get('similarity_score', 0)
            print(f"\n{i}. {clip['id']} (similarity: {score:.3f})")
            print(f"   {get_clip_text_representation(clip)[:150]}...")
    else:
        print("Usage:")
        print("  python semantic_search.py build           - Build embeddings for all clips")
        print("  python semantic_search.py search <query>  - Search clips")
