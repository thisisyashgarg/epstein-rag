#!/usr/bin/env python3
"""
Epstein RAG Ingestion Script (Text + Vision)
Uses PyMuPDF for text/image extraction and GPT-4o Vision for image descriptions.
Run once to build the local vector store.
"""

import os
import sys
import hashlib
import base64
from io import BytesIO
from pathlib import Path

import fitz  # PyMuPDF
import chromadb
import tiktoken
from PIL import Image
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

# ── Config ────────────────────────────────────────────────────────────────────
PDF_DIRS = [
    Path("/Users/yashgarg/Desktop/epstein-rag/1.4.23 Epstein Docs"),
    Path("/Users/yashgarg/Desktop/epstein-rag/Epstein Docs 1.5.24"),
    Path("/Users/yashgarg/Desktop/epstein-rag/Epstein docs 2"),
]
CHROMA_PATH = Path(__file__).parent.parent / "chroma_db"
COLLECTION_NAME = "epstein_docs"

EMBED_MODEL = "text-embedding-3-small"
VISION_MODEL = "gpt-4o"
CHUNK_SIZE = 400    # tokens
CHUNK_OVERLAP = 50  # tokens
MIN_TEXT_CHARS = 50 # skip near-empty pages
MAX_IMAGE_SIZE = (1024, 1024) # resize for vision API
# ──────────────────────────────────────────────────────────────────────────────

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
enc = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str) -> list[str]:
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunks.append(enc.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c.strip() for c in chunks if c.strip()]


def embed_texts(texts: list[str]) -> list[list[float]]:
    BATCH = 100
    all_embeddings = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i: i + BATCH]
        resp = client.embeddings.create(model=EMBED_MODEL, input=batch)
        all_embeddings.extend([e.embedding for e in resp.data])
    return all_embeddings


def make_chunk_id(filename: str, page: int, type_str: str, chunk_idx: int) -> str:
    raw = f"{filename}::p{page}::{type_str}::{chunk_idx}"
    return hashlib.md5(raw.encode()).hexdigest()


def get_image_description(image_bytes: bytes) -> str:
    """Uses GPT-4o Vision to get a searchable description of the image."""
    try:
        # Pre-process image to ensure it's not too large
        img = Image.open(BytesIO(image_bytes))
        img.thumbnail(MAX_IMAGE_SIZE)
        
        # Convert back to bytes (JPEG)
        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": "This image is from the Jeffrey Epstein court documents. Describe the content of this image in detail, including any text, names, handwriting, or events depicted. Focus on information that would be useful for a search query. If it is a scanned document page that failed OCR, transcribe the key parts."
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        },
                    ],
                }
            ],
            max_tokens=600,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"      ⚠️  Vision API error: {e}")
        return ""


def process_pdf(pdf_path: Path, folder_name: str, collection) -> int:
    # Skip if already indexed
    existing = collection.get(where={"filename": pdf_path.name})
    if existing["ids"]:
        print(f"  ⏭️  Already indexed {pdf_path.name} ({len(existing['ids'])} chunks) — skipping")
        return 0

    doc = fitz.open(pdf_path)
    all_docs, all_metas, all_ids = [], [], []

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_label = page_num + 1
        
        # 1. Text Extraction
        text = page.get_text("text").strip()
        if len(text) >= MIN_TEXT_CHARS:
            for idx, chunk in enumerate(chunk_text(text)):
                cid = make_chunk_id(pdf_path.name, page_label, "text", idx)
                all_docs.append(chunk)
                all_metas.append({
                    "filename": pdf_path.name,
                    "folder": folder_name,
                    "page": page_label,
                    "chunk_index": idx,
                    "type": "text",
                })
                all_ids.append(cid)

        # 2. Image Extraction
        image_list = page.get_images(full=True)
        if image_list:
            print(f"    📷 Found {len(image_list)} images on page {page_label}")
            for img_idx, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                if base_image["width"] < 100 or base_image["height"] < 100:
                    continue
                image_bytes = base_image["image"]
                
                print(f"      ⏳ Describing image {img_idx+1}/{len(image_list)} …")
                description = get_image_description(image_bytes)
                
                if description:
                    cid = make_chunk_id(pdf_path.name, page_label, "image", img_idx)
                    all_docs.append(description)
                    all_metas.append({
                        "filename": pdf_path.name,
                        "folder": folder_name,
                        "page": page_label,
                        "chunk_index": img_idx,
                        "type": "image_caption",
                    })
                    all_ids.append(cid)

    doc.close()

    if not all_docs:
        print(f"  ⚠️  No text extracted from {pdf_path.name}")
        return 0

    print(f"    Embedding {len(all_docs)} chunks …")
    all_embeddings = embed_texts(all_docs)
    collection.upsert(
        ids=all_ids,
        documents=all_docs,
        embeddings=all_embeddings,
        metadatas=all_metas,
    )
    return len(all_docs)


def main():
    print("🔍 Epstein RAG Ingestion (Text + Vision)")
    print(f"   ChromaDB path: {CHROMA_PATH}")
    print(f"   Embed model:   {EMBED_MODEL}\n")

    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    chroma_client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    grand_total_chunks = 0
    grand_total_pdfs = 0

    for pdf_dir in PDF_DIRS:
        if not pdf_dir.exists():
            print(f"⚠️  Directory not found: {pdf_dir}")
            continue

        pdfs = sorted(pdf_dir.glob("*.pdf"))
        print(f"📁 {pdf_dir.name} — {len(pdfs)} PDFs")

        for pdf_path in pdfs:
            print(f"  📄 {pdf_path.name}")
            try:
                n = process_pdf(pdf_path, pdf_dir.name, collection)
                grand_total_chunks += n
                grand_total_pdfs += 1
                if n > 0:
                    print(f"     ✅ {n} chunks indexed")
            except Exception as e:
                print(f"     ❌ Error: {e}")

        print()

    print("─" * 50)
    print(f"✅ Done! Indexed {grand_total_chunks} total chunks from {grand_total_pdfs} PDFs")
    print(f"   Collection size: {collection.count()} chunks in ChromaDB")


if __name__ == "__main__":
    if not os.environ.get("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set. Add it to .env in the project root.")
        sys.exit(1)
    main()
