# Backend

Express + TypeScript API server. Manages the ChromaDB subprocess, handles search queries, and serves PDF files.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the backend + ChromaDB server (hot-reload) |
| `npm run ingest` | Index PDFs into ChromaDB (run once, then re-run for new PDFs) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/search` | Semantic search + GPT-4o answer. Body: `{ query: string, topK?: number }` |
| `GET` | `/pdf/:folder/:filename` | Stream a PDF file for the inline viewer |
| `GET` | `/health` | Returns collection status and chunk count |

## How It Works

1. On startup, spawns a ChromaDB HTTP server (using the Python binary from `ingest/venv/bin/chroma`)
2. On each `/search` request:
   - Embeds the query using `text-embedding-3-small`
   - Queries ChromaDB for the top-K most similar chunks
   - Filters out results below 50% similarity
   - Feeds matching excerpts to GPT-4o to generate a cited answer
3. On shutdown (SIGINT or SIGTERM), kills the ChromaDB subprocess cleanly

## Environment

Requires a `.env` file in the **project root** (one level up):

```
OPENAI_API_KEY=sk-...
```

## Ingest Script

`src/ingest.ts` — text-only PDF indexer. Connects to the same ChromaDB server.

```bash
# Start backend first (to start ChromaDB), then in a second terminal:
npm run ingest
```

Skips already-indexed files — safe to re-run.
