# Epstein RAG

A local-first **Retrieval-Augmented Generation (RAG)** app for searching and understanding the Jeffrey Epstein court documents using AI.

> Search across 194+ legal PDFs using natural language. Get cited AI answers with clickable source documents and an inline PDF viewer.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![Stack](https://img.shields.io/badge/TypeScript-5-blue) ![Stack](https://img.shields.io/badge/ChromaDB-3-orange) ![Stack](https://img.shields.io/badge/OpenAI-GPT--4o-green)

---

## How It Works

```
PDFs → Ingest Script → ChromaDB (local vector store)
                              ↓
User Query → OpenAI Embedding → ChromaDB Search → GPT-4o Answer + Sources
```

1. **Ingest** — extracts text from PDFs, chunks it, and stores embeddings in a local ChromaDB database
2. **Backend** — Express server that embeds queries, searches ChromaDB, and synthesizes answers via GPT-4o
3. **Frontend** — Next.js search UI with AI answer display, source cards, and inline PDF viewer

---

## Project Structure

```
epstein-rag/
├── backend/          # Express API + ChromaDB manager
├── frontend/         # Next.js UI
├── ingest/           # TypeScript PDF ingestion script
├── chroma_db/        # Local vector database (gitignored)
├── .env              # API keys (gitignored)
└── .env.example      # Template
```

---

## Prerequisites

- Node.js 20+
- Python 3.9+ with `pip`
- An [OpenAI API key](https://platform.openai.com/api-keys)

---

## Setup

### 1. Clone & configure environment

```bash
git clone https://github.com/thisisyashgarg/epstein-rag.git
cd epstein-rag
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 2. Install backend dependencies

```bash
cd backend && npm install
```

### 3. Install frontend dependencies

```bash
cd frontend && npm install
```

### 4. Set up Python ingest environment

```bash
cd ingest
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 5. Add your PDFs

Place your PDF folders into the project root and update the `PDF_DIRS` array in `backend/src/ingest.ts` to point to them.

### 6. Run the ingestion (one-time)

```bash
# Terminal 1 — start ChromaDB via backend
cd backend && npm run dev

# Terminal 2 — run ingest (takes a few minutes)
cd backend && npm run ingest
```

### 7. Start the app

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | Express, TypeScript, ts-node-dev |
| Vector DB | ChromaDB (local HTTP server) |
| Embeddings | `text-embedding-3-small` (OpenAI) |
| AI Answers | GPT-4o |
| PDF Parsing | `pdf-parse` |

---

## Notes

- `chroma_db/` is gitignored — re-run `npm run ingest` after cloning to rebuild the vector database
- The ingest script is **idempotent** — safe to re-run, already-indexed files are skipped
- Only source documents with **≥50% relevance** to your query are shown
