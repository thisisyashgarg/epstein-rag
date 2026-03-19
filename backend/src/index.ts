import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { ChromaClient } from "chromadb";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHROMA_DB_PATH = path.resolve(__dirname, "../../chroma_db");
const CHROMA_PORT = 8001;
const COLLECTION_NAME = "epstein_docs";
const EMBED_MODEL = "text-embedding-3-small";
const ANSWER_MODEL = "gpt-4o";
const MIN_SCORE = 50; // minimum similarity % to show a source document

const PDF_DIR_MAP: Record<string, string> = {
  "1.4.23 Epstein Docs": "/Users/yashgarg/Desktop/epstein-rag/1.4.23 Epstein Docs",
  "Epstein Docs 1.5.24": "/Users/yashgarg/Desktop/epstein-rag/Epstein Docs 1.5.24",
  "Epstein docs 2": "/Users/yashgarg/Desktop/epstein-rag/Epstein docs 2",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let collection: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chromaProcess: any = null;

// ── Spawn ChromaDB HTTP server ────────────────────────────────────────────────

async function isChromaAlreadyRunning(): Promise<boolean> {
  try {
    const resp = await fetch(`http://localhost:${CHROMA_PORT}/api/v2/heartbeat`);
    return resp.ok;
  } catch {
    return false;
  }
}

async function startChromaServer(): Promise<void> {
  // If ChromaDB is already up (e.g. ts-node-dev hot-restart), reuse it
  if (await isChromaAlreadyRunning()) {
    console.log(`♻️  ChromaDB already running at http://localhost:${CHROMA_PORT} — reusing`);
    return;
  }

  return new Promise((resolve, reject) => {
    console.log(`🗄️  Starting ChromaDB server on port ${CHROMA_PORT}…`);

    // Try to find chroma in common locations
    const venvChroma = path.resolve(__dirname, "../../ingest/venv/bin/chroma");
    const chromaBin = fs.existsSync(venvChroma) ? venvChroma : "chroma";

    chromaProcess = spawn(
      chromaBin,
      ["run", "--path", CHROMA_DB_PATH, "--port", String(CHROMA_PORT)],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    chromaProcess.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.log(`[chroma] ${msg}`);
    });

    chromaProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.log(`[chroma] ${msg}`);
    });

    chromaProcess.on("error", (err: Error) => {
      console.error("ChromaDB process error:", err);
      reject(err);
    });

    // Wait for ChromaDB to be ready (poll the health endpoint)
    const maxAttempts = 30;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(poll);
        reject(new Error("ChromaDB did not start in time"));
        return;
      }
      try {
        const resp = await fetch(`http://localhost:${CHROMA_PORT}/api/v2/heartbeat`);
        if (resp.ok) {
          clearInterval(poll);
          console.log(`✅ ChromaDB ready at http://localhost:${CHROMA_PORT}`);
          resolve();
        }
      } catch {
        // not ready yet, keep polling
      }
    }, 1000);
  });
}

// ── Init ChromaDB client ──────────────────────────────────────────────────────

async function initChromaClient() {
  const chroma = new ChromaClient({ path: `http://localhost:${CHROMA_PORT}` });
  collection = await chroma.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });
  const count = await collection.count();
  console.log(`✅ Connected to collection "${COLLECTION_NAME}" — ${count} chunks`);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  filename: string;
  folder: string;
  page: number;
  snippet: string;
  type: "text" | "image_caption";
  score: number;
}

interface SearchResponse {
  answer: string;
  sources: SearchResult[];
  query: string;
}

// ── POST /search ──────────────────────────────────────────────────────────────

app.post("/search", async (req: Request, res: Response) => {
  try {
    const { query, topK = 8 } = req.body as { query: string; topK?: number };

    if (!query?.trim()) {
      return res.status(400).json({ error: "query is required" });
    }

    // 1. Embed the query
    const embedResp = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: query,
    });
    const queryEmbedding = embedResp.data[0].embedding;

    // 2. Search ChromaDB
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      include: ["documents", "metadatas", "distances"] as any,
    });

    const documents = results.documents[0] ?? [];
    const metadatas = results.metadatas[0] ?? [];
    const distances = results.distances?.[0] ?? [];

    // 3. Build sources list — filter out low-relevance results
    const sources: SearchResult[] = documents
      .map((doc: string | null, i: number) => {
        const meta = metadatas[i] as Record<string, string | number>;
        const distance = distances[i] ?? 1;
        return {
          filename: String(meta.filename),
          folder: String(meta.folder),
          page: Number(meta.page),
          snippet: doc ?? "",
          type: (meta.type as "text" | "image_caption") ?? "text",
          score: Math.round((1 - distance) * 100),
        };
      })
      .filter((s: SearchResult) => s.score >= MIN_SCORE);

    // 4. Build context for GPT-4o answer
    const contextBlocks = sources
      .map(
        (s, i) =>
          `[Source ${i + 1}: ${s.filename}, page ${s.page}${s.type === "image_caption" ? " (image)" : ""}]\n${s.snippet}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `You are a research assistant helping analyze the Jeffrey Epstein court documents.
Answer the user's question based ONLY on the provided document excerpts.
Be factual, cite which source files support your answer (by filename and page).
If you cannot answer from the context, say so clearly.`;

    const chatResp = await openai.chat.completions.create({
      model: ANSWER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Question: ${query}\n\nDocument excerpts:\n${contextBlocks}\n\nProvide a thorough answer citing specific sources.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const answer = chatResp.choices[0].message.content ?? "No answer generated.";
    const response: SearchResponse = { answer, sources, query };
    return res.json(response);
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err) });
  }
});

// ── GET /pdf/:folder/:filename ────────────────────────────────────────────────

app.get("/pdf/:folder/:filename", (req: Request, res: Response) => {
  const { folder, filename } = req.params;
  const dirPath = PDF_DIR_MAP[decodeURIComponent(folder)];

  if (!dirPath) return res.status(404).json({ error: "Folder not found" });

  const filePath = path.join(dirPath, decodeURIComponent(filename));
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(dirPath);

  if (!resolvedPath.startsWith(resolvedDir)) return res.status(403).json({ error: "Forbidden" });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${decodeURIComponent(filename)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// ── GET /health ───────────────────────────────────────────────────────────────

app.get("/health", async (_req: Request, res: Response) => {
  const count = await collection.count();
  res.json({ status: "ok", chunks: count, collection: COLLECTION_NAME });
});

// ── Graceful shutdown (handles both Ctrl-C and ts-node-dev hot-restart) ────────

function shutdown() {
  console.log("\n🛑 Shutting down…");
  chromaProcess?.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await startChromaServer();
    await initChromaClient();
    app.listen(PORT, () => {
      console.log(`🚀 Backend running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Startup failed:", err);
    chromaProcess?.kill();
    process.exit(1);
  }
})();
