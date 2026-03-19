# Frontend

Next.js 16 search interface for the Epstein RAG app.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (defaults to port 3000) |
| `npm run build` | Build for production |
| `npm start` | Serve production build |

## Features

- **Search bar** — natural language queries against 194+ court documents
- **AI Answer** — GPT-4o generated answer with source citations
- **Source Cards** — ranked document matches with filename, page number, and relevance score
- **Inline PDF Viewer** — click any source card to open the PDF at the right page

## Stack

- Next.js 16 (webpack mode — required for `react-pdf` compatibility)
- React 19
- Tailwind CSS v4
- `react-pdf` for PDF rendering

## Environment

The frontend calls the backend at `http://localhost:3001` by default. Update `app/page.tsx` if your backend runs on a different port.
