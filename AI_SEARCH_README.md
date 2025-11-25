# 🤖 AI Semantic Search for Clips

## Overview

The AI Semantic Search feature allows you to find clips using natural language queries like:
- "Horns actions with drop coverage that led to made 3s"
- "Find all possessions where we disrupted the ball screen"
- "Show me defensive breakdowns in transition"

Instead of manually filtering by tags, just describe what you're looking for!

## Setup Instructions

### 1. Install Required Packages

```bash
cd /Users/ashtonjantz/Desktop/Defense
pip install openai numpy
```

### 2. Set Your OpenAI API Key

You need an OpenAI API key to use the embedding model. Get one at: https://platform.openai.com/api-keys

#### Option A: Set Environment Variable (Recommended)

**For current terminal session:**
```bash
export OPENAI_API_KEY='your-api-key-here'
```

**To make it permanent (macOS/Linux):**
Add to your `~/.zshrc` or `~/.bash_profile`:
```bash
echo 'export OPENAI_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

#### Option B: Add to Launch Script

Edit `/Users/ashtonjantz/Desktop/Defense/start_defense_analytics.sh` and add near the top:
```bash
export OPENAI_API_KEY='your-api-key-here'
```

### 3. Build Initial Embeddings

Generate embeddings for all existing clips:

```bash
cd /Users/ashtonjantz/Desktop/Defense
python3 semantic_search.py build
```

This will:
- Read all clips from the database
- Generate text representations of each clip's metadata
- Create embeddings using OpenAI's `text-embedding-3-small` model
- Save embeddings to `data/clip_embeddings.json`

**Note:** This costs approximately $0.02 per 1000 clips (OpenAI pricing as of 2025).

### 4. Restart the Server

After installing packages and setting the API key, restart:

```bash
# Kill existing processes
lsof -ti:8000 | xargs kill -9

# Restart (or use the app launcher)
python3 media_server.py
```

## Usage

### In the React UI

1. Go to the **Clips (react)** tab
2. Look for the AI Search bar at the top with the 🤖 icon
3. Type your natural language query
4. Press Enter or click "Search"

**Example Queries:**
- `Horns formations with help rotation`
- `Made 3-pointers from corner`
- `Defensive stops with ball screen drop coverage`
- `Transition defense possessions`
- `Possessions with paint touches that resulted in fouls`

### Via Command Line

Test search from terminal:

```bash
python3 semantic_search.py search "Horns actions with drop coverage"
```

### Rebuilding Embeddings

After adding new clips or updating metadata, rebuild embeddings:

```bash
python3 semantic_search.py build
```

Or use the API endpoint:

```bash
curl -X POST http://127.0.0.1:8000/api/search/rebuild-embeddings
```

## How It Works

1. **Text Representation**: Each clip is converted to a rich text description including:
   - Formation, coverage, actions
   - Shot location, result, points
   - Defensive disruption, breakdown
   - Play result and notes

2. **Embeddings**: OpenAI's embedding model converts these descriptions into 1536-dimensional vectors that capture semantic meaning

3. **Search**: Your query is embedded and compared to all clip embeddings using cosine similarity

4. **Ranking**: Results are sorted by similarity score (higher = better match)

## Cost & Performance

- **Embedding Generation**: ~$0.02 per 1000 clips (one-time cost)
- **Search Queries**: ~$0.00002 per search
- **Speed**: Searches complete in ~1-2 seconds
- **Storage**: ~2MB per 1000 clips for embeddings

## Troubleshooting

### "Semantic search not available"
- Install required packages: `pip install openai numpy`
- Set OPENAI_API_KEY environment variable
- Restart the media server

### "No embeddings found"
- Run `python3 semantic_search.py build` to generate embeddings
- Check that `data/clip_embeddings.json` exists

### Poor Search Results
- Make sure embeddings are up to date after adding/editing clips
- Try more specific queries with basketball terminology
- Include key details: formations, actions, results

## API Endpoints

### POST /api/search/semantic
Search clips using natural language.

**Request:**
```json
{
  "query": "Horns actions with drop coverage",
  "top_k": 20
}
```

**Response:**
```json
{
  "ok": true,
  "query": "Horns actions with drop coverage",
  "count": 20,
  "results": [...]
}
```

### POST /api/search/rebuild-embeddings
Rebuild all embeddings after data changes.

### GET /api/search/status
Check if semantic search is configured correctly.

## Tips for Best Results

1. **Use Basketball Terms**: "Horns", "drop coverage", "ball screen", "transition"
2. **Be Specific**: Mention formations, actions, results you care about
3. **Combine Concepts**: "Horns actions with drop coverage that led to made 3s"
4. **Rebuild After Changes**: Run `python3 semantic_search.py build` after tagging new clips

## Future Enhancements

- Auto-rebuild embeddings when clips are saved
- Cached embeddings for faster subsequent searches
- Multi-field semantic search (e.g., search within notes only)
- Similarity threshold filtering
- Export semantic search results
