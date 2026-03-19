'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  folder: string;
  filename: string;
  initialPage: number;
  onClose: () => void;
}

export default function PDFViewerModal({ folder, filename, initialPage, onClose }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.2);

  const pdfUrl = `http://localhost:3001/pdf/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && currentPage < (numPages ?? 1)) setCurrentPage(p => p + 1);
    if (e.key === 'ArrowLeft' && currentPage > 1) setCurrentPage(p => p - 1);
  }, [onClose, currentPage, numPages]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Filename */}
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          color: 'var(--text-primary)',
          fontWeight: 500,
        }}>
          {filename}
        </span>
        <span style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          background: 'var(--bg-card)',
          padding: '2px 8px',
          borderRadius: 999,
          border: '1px solid var(--border)',
        }}>
          {folder}
        </span>

        <div style={{ flex: 1 }} />

        {/* Page controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            style={navBtnStyle(currentPage <= 1)}
          >←</button>

          <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 80, textAlign: 'center' }}>
            pg {currentPage} / {numPages ?? '…'}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(numPages ?? p, p + 1))}
            disabled={currentPage >= (numPages ?? 1)}
            style={navBtnStyle(currentPage >= (numPages ?? 1))}
          >→</button>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={iconBtnStyle}>−</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px', minWidth: 40, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.2))} style={iconBtnStyle}>+</button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '6px 14px',
            color: '#f87171',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* PDF content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '24px',
      }}>
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div style={{ color: 'var(--text-secondary)', fontSize: 15, marginTop: 80 }}>
              Loading PDF…
            </div>
          }
          error={
            <div style={{ color: '#f87171', fontSize: 15, marginTop: 80, textAlign: 'center' }}>
              <div>Failed to load PDF.</div>
              <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>
                Make sure the backend is running on localhost:3001
              </div>
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            renderAnnotationLayer
            renderTextLayer
          />
        </Document>
      </div>

      {/* Page jump input */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        padding: '10px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jump to page:</span>
        <input
          type="number"
          min={1}
          max={numPages ?? 1}
          value={currentPage}
          onChange={e => {
            const v = parseInt(e.target.value);
            if (v >= 1 && v <= (numPages ?? 1)) setCurrentPage(v);
          }}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 10px',
            color: 'var(--text-primary)',
            fontSize: 13,
            width: 70,
            textAlign: 'center',
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>← → keys also work</span>
      </div>
    </div>
  );
}

const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '5px 12px',
  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 14,
  opacity: disabled ? 0.5 : 1,
});

const iconBtnStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 10px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 16,
};
