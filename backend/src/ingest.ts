#!/usr/bin/env ts-node
/**
 * Epstein RAG — TypeScript Ingestion Script
 * Indexes all PDFs into ChromaDB using text extraction + OpenAI embeddings.
 * No image/vision captioning — text-only, fast.
 *
 * Usage:
 *   npm run ingest       (ChromaDB server must already be running via npm run dev)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
// pdf-parse v1 ships as CommonJS; use require() to avoid ESM call-signature issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  dataBuffer: Buffer,
  options?: Record<string, unknown>
) => Promise<{ text: string; numpages: number }>;
import OpenAI from "openai";
import { ChromaClient } from "chromadb";
import { get_encoding } from "@dqbd/tiktoken";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── Config ─────────────────────────────────────────────────────────────────────

const PDF_DIRS: string[] = [
  "/Users/yashgarg/Desktop/epstein-rag/1.4.23 Epstein Docs",
  "/Users/yashgarg/Desktop/epstein-rag/Epstein Docs 1.5.24",
  "/Users/yashgarg/Desktop/epstein-rag/Epstein docs 2",
];

const CHROMA_PORT = 8001;
const COLLECTION_NAME = "epstein_docs";
const EMBED_MODEL = "text-embedding-3-small";
const CHUNK_SIZE = 400;    // tokens
const CHUNK_OVERLAP = 50;  // tokens
const EMBED_BATCH = 100;   // chunks per OpenAI request

// ────────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const enc = get_encoding("cl100k_base");

// ── Helpers ────────────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const tokens = enc.encode(text);
  const chunks: string[] = [];
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE, tokens.length);
    const slice = tokens.slice(start, end);
    const decoded = new TextDecoder().decode(enc.decode(slice));
    const trimmed = decoded.trim();
    if (trimmed) chunks.push(trimmed);
    if (end === tokens.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const resp = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch,
    });
    allEmbeddings.push(...resp.data.map((e) => e.embedding));
  }

  return allEmbeddings;
}

function makeChunkId(filename: string, page: number, chunkIdx: number): string {
  const raw = `${filename}::p${page}::text::${chunkIdx}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

// ── Core PDF processor ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPdf(pdfPath: string, folderName: string, collection: any): Promise<number> {
  const filename = path.basename(pdfPath);

  // Skip if already indexed
  const existing = await collection.get({ where: { filename } });
  if (existing.ids.length > 0) {
    console.log(`  ⏭️  Already indexed ${filename} (${existing.ids.length} chunks) — skipping`);
    return 0;
  }

  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);

  // pdf-parse gives us all text in one block; we split by page via pagerender
  // For simplicity treat the whole document as page 1 since pdf-parse doesn't
  // expose per-page text by default — use pagerender to capture per-page output.
  const allDocs: string[] = [];
  const allMetas: object[] = [];
  const allIds: string[] = [];

  // Re-parse with pagerender to get per-page text
  const pageTexts: string[] = [];
  await pdfParse(buffer, {
    pagerender: (pageData: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (pageData as any).getTextContent().then((tc: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = tc.items.map((item: any) => item.str).join(" ");
        pageTexts.push(text);
        return text;
      });
    },
  });

  // Fallback: if pagerender gave 0 pages, use the full text as page 1
  const pages: string[] = pageTexts.length > 0 ? pageTexts : [data.text];

  pages.forEach((pageText, pageIdx) => {
    const text = pageText.trim();
    if (!text) return;

    const chunks = chunkText(text);
    chunks.forEach((chunk, chunkIdx) => {
      const id = makeChunkId(filename, pageIdx + 1, chunkIdx);
      allDocs.push(chunk);
      allMetas.push({
        filename,
        folder: folderName,
        page: pageIdx + 1,
        chunk_index: chunkIdx,
        type: "text",
      });
      allIds.push(id);
    });
  });

  if (allDocs.length === 0) {
    console.log(`  ⚠️  No text extracted from ${filename}`);
    return 0;
  }

  console.log(`    Embedding ${allDocs.length} chunks …`);
  const embeddings = await embedTexts(allDocs);

  await collection.upsert({
    ids: allIds,
    documents: allDocs,
    embeddings,
    metadatas: allMetas,
  });

  return allDocs.length;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌  OPENAI_API_KEY not set. Add it to .env in the project root.");
    process.exit(1);
  }

  console.log("🔍  Epstein RAG Ingestion (TypeScript, text-only)");
  console.log(`    Embed model: ${EMBED_MODEL}`);
  console.log(`    ChromaDB:    http://localhost:${CHROMA_PORT}\n`);

  const chroma = new ChromaClient({
    host: "localhost",
    port: CHROMA_PORT,
    ssl: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collection: any = await chroma.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });

  let grandTotalChunks = 0;
  let grandTotalPdfs = 0;

  for (const pdfDir of PDF_DIRS) {
    if (!fs.existsSync(pdfDir)) {
      console.log(`⚠️  Directory not found: ${pdfDir}`);
      continue;
    }

    const pdfs = fs
      .readdirSync(pdfDir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort()
      .map((f) => path.join(pdfDir, f));

    const folderName = path.basename(pdfDir);
    console.log(`📁  ${folderName} — ${pdfs.length} PDFs`);

    for (const pdfPath of pdfs) {
      console.log(`  📄  ${path.basename(pdfPath)}`);
      try {
        const n = await processPdf(pdfPath, folderName, collection);
        grandTotalChunks += n;
        grandTotalPdfs += 1;
        if (n > 0) console.log(`     ✅  ${n} chunks indexed`);
      } catch (err) {
        console.error(`     ❌  Error: ${err}`);
      }
    }

    console.log();
  }

  const totalInDb = await collection.count();
  console.log("─".repeat(50));
  console.log(`✅  Done! Indexed ${grandTotalChunks} new chunks from ${grandTotalPdfs} PDFs`);
  console.log(`   Collection total: ${totalInDb} chunks in ChromaDB`);

  enc.free();
}

main().catch((err) => {
  console.error("Fatal:", err);
  enc.free();
  process.exit(1);
});
