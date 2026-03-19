# Ingest

PDF ingestion pipeline for the Epstein RAG app. Extracts text from PDFs, chunks it, generates embeddings via OpenAI, and stores everything in a local ChromaDB database.

## Recommended: TypeScript Ingest (via the backend)

The primary ingest script is `backend/src/ingest.ts`. Run it from the `backend/` directory:

```bash
# 1. Start the backend first (to start ChromaDB)
cd ../backend && npm run dev

# 2. In a separate terminal, run the ingest
cd ../backend && npm run ingest
```

## Python Ingest (legacy)

`ingest.py` is the original Python version. It additionally supports **GPT-4o Vision** for scanned pages and embedded images, but is slower and costlier.

### Setup

```bash
cd ingest
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Run

```bash
python3 ingest.py
```

> ⚠️ The Python ingest will call GPT-4o Vision for scanned pages, which costs more. Use the TypeScript version for text-only indexing.

## How Chunking Works

- Text is split into **400-token chunks** with a **50-token overlap** using `tiktoken` (`cl100k_base` encoding)
- Each chunk gets an MD5 ID derived from `filename + page + chunk_index`
- The same IDs are used by both the TypeScript and Python scripts — they are **compatible and idempotent**

## Configuration

Update the `PDF_DIRS` array in `backend/src/ingest.ts` (or `ingest.py`) to point to your PDF folders:

```typescript
const PDF_DIRS: string[] = [
  "/path/to/your/pdfs/folder1",
  "/path/to/your/pdfs/folder2",
];
```
