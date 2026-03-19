'use client';

import { useState, useRef, useEffect } from 'react';
import PDFViewerModal from '@/components/PDFViewerModal';
import SourceCard from '@/components/SourceCard';
import AnswerBox from '@/components/AnswerBox';

interface Source {
  filename: string;
  folder: string;
  page: number;
  snippet: string;
  type: 'text' | 'image_caption';
  score: number;
}

interface SearchResponse {
  answer: string;
  sources: Source[];
  query: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [pdfViewer, setPdfViewer] = useState<{ folder: string; filename: string; page: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch('http://localhost:3001/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), topK: 8 }),
      });

      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const data: SearchResponse = await resp.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const exampleQueries = [
    'Who visited Epstein\'s island?',
    'Flight logs and passenger lists',
    'Handwritten letters or notes',
    'Virginia Giuffre testimony',
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(17, 20, 28, 0.8)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 60, gap: 12 }}>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #4f7ef7, #9b5fff)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>⚖️</div>
            <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
              Epstein Files
            </span>
            <span style={{
              background: 'var(--tag-bg)',
              color: 'var(--tag-text)',
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
              fontFamily: 'JetBrains Mono, monospace',
              border: '1px solid rgba(79,126,247,0.2)',
            }}>AI Search</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>194 documents · 3 collections</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '64px 0 40px' }}>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #4f7ef7 0%, #9b5fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: 12,
          }}>
            Search the Epstein Files
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: 0 }}>
            Semantic AI search across 194 court documents — text, images, and handwriting
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            gap: 12,
            background: 'var(--bg-card)',
            border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border)'}`,
            borderRadius: 14,
            padding: '6px 6px 6px 20px',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: focused ? '0 0 0 3px var(--accent-glow)' : 'none',
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 18, flexShrink: 0 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Describe what you're looking for — incidents, people, places, images..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 16,
                caretColor: 'var(--accent)',
              }}
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              style={{
                background: loading || !query.trim()
                  ? 'var(--border)'
                  : 'linear-gradient(135deg, #4f7ef7, #7b5ff7)',
                color: loading || !query.trim() ? 'var(--text-muted)' : 'white',
                border: 'none',
                borderRadius: 10,
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>

        {/* Example queries */}
        {!result && !loading && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
            {exampleQueries.map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); setTimeout(() => handleSearch(), 50); }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.target as HTMLButtonElement).style.color = 'var(--text-primary)';
                  (e.target as HTMLButtonElement).style.borderColor = 'var(--border-focus)';
                }}
                onMouseLeave={e => {
                  (e.target as HTMLButtonElement).style.color = 'var(--text-secondary)';
                  (e.target as HTMLButtonElement).style.borderColor = 'var(--border)';
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ marginTop: 32 }}>
            <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 140, marginBottom: 16 }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            padding: '16px 20px',
            color: '#f87171',
            marginTop: 24,
          }}>
            ⚠️ {error}. Make sure the backend is running on <code>localhost:3001</code>.
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ marginTop: 32 }}>
            {/* Answer Box */}
            <AnswerBox answer={result.answer} query={result.query} />

            {/* Sources */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '32px 0 16px',
            }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Source Documents
              </h2>
              <div style={{
                flex: 1,
                height: 1,
                background: 'var(--border)',
              }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{result.sources.length} results</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {result.sources.map((source, i) => (
                <SourceCard
                  key={i}
                  source={source}
                  index={i}
                  onOpenPDF={() => setPdfViewer({ folder: source.folder, filename: source.filename, page: source.page })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
            <div style={{ fontSize: 15 }}>194 documents ready to search</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Text, scanned pages, and embedded images are all indexed</div>
          </div>
        )}
      </main>

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <PDFViewerModal
          folder={pdfViewer.folder}
          filename={pdfViewer.filename}
          initialPage={pdfViewer.page}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  );
}
