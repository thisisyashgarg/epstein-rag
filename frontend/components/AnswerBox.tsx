'use client';

interface Props {
  answer: string;
  query: string;
}

export default function AnswerBox({ answer, query }: Props) {
  return (
    <div
      className="fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(79,126,247,0.08) 0%, rgba(155,95,255,0.06) 100%)',
        border: '1px solid rgba(79,126,247,0.25)',
        borderRadius: 14,
        padding: '24px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow blob */}
      <div style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 180,
        height: 180,
        background: 'radial-gradient(circle, rgba(79,126,247,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 16 }}>✨</span>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          AI Answer
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          for "{query}"
        </span>
      </div>

      {/* Answer text */}
      <p style={{
        margin: 0,
        fontSize: 15,
        lineHeight: 1.75,
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
      }}>
        {answer}
      </p>

      {/* Disclaimer */}
      <p style={{
        margin: '16px 0 0',
        fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        ⚠️ Generated from document excerpts only — always verify against source documents below.
      </p>
    </div>
  );
}
