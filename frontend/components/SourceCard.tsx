'use client';

interface Source {
  filename: string;
  folder: string;
  page: number;
  snippet: string;
  type: 'text' | 'image_caption';
  score: number;
}

interface Props {
  source: Source;
  index: number;
  onOpenPDF: () => void;
}

const FOLDER_COLORS: Record<string, string> = {
  '1.4.23 Epstein Docs': '#f5a623',
  'Epstein Docs 1.5.24': '#4f7ef7',
  'Epstein docs 2': '#3ecf8e',
};

export default function SourceCard({ source, index, onOpenPDF }: Props) {
  const delayClass = `fade-in fade-in-delay-${Math.min(index + 1, 8)}`;
  const folderColor = FOLDER_COLORS[source.folder] ?? '#7986a8';

  return (
    <div
      className={delayClass}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '18px 20px',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-focus)';
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Score badge */}
        <div style={{
          background: `rgba(${source.score > 70 ? '62,207,142' : source.score > 50 ? '245,166,35' : '120,120,150'},0.12)`,
          color: source.score > 70 ? '#3ecf8e' : source.score > 50 ? '#f5a623' : '#7986a8',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 999,
          fontFamily: 'JetBrains Mono, monospace',
          flexShrink: 0,
        }}>
          {source.score}% match
        </div>

        {/* Filename */}
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          color: 'var(--text-primary)',
          fontWeight: 500,
        }}>
          {source.filename}
        </span>

        {/* Page number */}
        <span style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          padding: '2px 8px',
          borderRadius: 999,
          border: '1px solid var(--border)',
        }}>
          p.{source.page}
        </span>

        {/* Type badge */}
        {source.type === 'image_caption' && (
          <span style={{
            background: 'var(--image-tag-bg)',
            color: 'var(--image-tag-text)',
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid rgba(183,136,255,0.2)',
          }}>
            🖼 image
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Folder badge */}
        <span style={{
          fontSize: 11,
          color: folderColor,
          background: `${folderColor}18`,
          padding: '2px 10px',
          borderRadius: 999,
          border: `1px solid ${folderColor}30`,
          whiteSpace: 'nowrap',
        }}>
          {source.folder}
        </span>
      </div>

      {/* Snippet */}
      <p style={{
        margin: '0 0 14px',
        fontSize: 13.5,
        lineHeight: 1.65,
        color: 'var(--text-secondary)',
        display: '-webkit-box',
        WebkitLineClamp: 4,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {source.snippet}
      </p>

      {/* Open PDF button */}
      <button
        onClick={onOpenPDF}
        style={{
          background: 'transparent',
          border: '1px solid var(--border-focus)',
          borderRadius: 8,
          padding: '7px 16px',
          fontSize: 13,
          color: 'var(--accent)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-glow)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        📄 Open PDF at page {source.page}
      </button>
    </div>
  );
}
