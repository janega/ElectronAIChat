import React, { useState } from 'react';

const TAG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  preference: { color: 'var(--c-teal)', bg: 'rgba(78,201,176,0.1)', border: 'rgba(78,201,176,0.2)' },
  context:    { color: 'var(--c-blue)', bg: 'rgba(86,156,214,0.1)', border: 'rgba(86,156,214,0.2)' },
  skill:      { color: 'var(--c-yellow)', bg: 'rgba(220,220,170,0.1)', border: 'rgba(220,220,170,0.2)' },
  config:     { color: 'var(--c-orange)', bg: 'rgba(206,145,120,0.1)', border: 'rgba(206,145,120,0.2)' },
};

interface MemoryEntry {
  id: string | number;
  text?: string;
  memory?: string;
  ts?: string;
  tag?: string;
  metadata?: Record<string, any>;
}

const BrainIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5C12 3.34 10.66 2 9 2a3 3 0 0 0-3 3c0 .35.06.69.17 1A3 3 0 0 0 4 9a3 3 0 0 0 1.17 2.37A3 3 0 0 0 6 14a3 3 0 0 0 3 3h1"/>
    <path d="M12 5c0-1.66 1.34-3 3-3a3 3 0 0 1 3 3c0 .35-.06.69-.17 1A3 3 0 0 1 20 9a3 3 0 0 1-1.17 2.37A3 3 0 0 1 18 14a3 3 0 0 1-3 3h-1"/>
    <path d="M9 17v1a3 3 0 0 0 6 0v-1"/>
    <line x1="12" y1="5" x2="12" y2="17"/>
  </svg>
);

interface MemoryPanelProps {
  memories?: MemoryEntry[];
}

export function MemoryPanel({ memories = [] }: MemoryPanelProps) {
  const [search, setSearch] = useState('');

  const filtered = memories.filter((m) => {
    const text = m.text || m.memory || '';
    return text.toLowerCase().includes(search.toLowerCase());
  });

  // Derive stats
  const factCount = memories.length;
  // Count unique sessions from metadata if available
  const sessionSet = new Set(memories.map((m) => m.metadata?.chatId).filter(Boolean));
  const sessionCount = sessionSet.size || 0;
  // "deduped" = entries without duplicates in text
  const uniqueTexts = new Set(memories.map((m) => m.text || m.memory));
  const dedupedCount = uniqueTexts.size;

  const stats = [
    { label: 'facts', value: String(factCount), color: 'var(--c-teal)' },
    { label: 'sessions', value: String(sessionCount), color: 'var(--c-blue)' },
    { label: 'deduped', value: String(dedupedCount), color: 'var(--c-yellow)' },
  ];

  function inferTag(entry: MemoryEntry): string {
    const text = (entry.text || entry.memory || '').toLowerCase();
    if (text.includes('prefer') || text.includes('like') || text.includes('love')) return 'preference';
    if (text.includes('using') || text.includes('config') || text.includes('model')) return 'config';
    if (text.includes('work') || text.includes('build') || text.includes('project')) return 'context';
    return 'skill';
  }

  return (
    <div style={{
      width: 260, background: 'var(--c-surface)',
      borderLeft: '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 42, borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--c-text-lo)' }}><BrainIcon /></span>
        <span style={{
          fontSize: 12, color: 'var(--c-text-mid)', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}>
          Memory
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--c-divider)' }}>
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              borderRight: i < stats.length - 1 ? '1px solid var(--c-divider)' : 'none',
            }}
          >
            <div style={{ fontSize: 17, fontFamily: 'var(--font-mono)', fontWeight: 600, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--c-input)', borderRadius: 4, padding: '5px 9px',
        }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--c-text-lo)" strokeWidth="1.5"/>
            <path d="M11 11L15 15" stroke="var(--c-text-lo)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories…"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--c-text-mid)', fontSize: 12, fontFamily: 'var(--font-mono)', width: '100%',
            }}
          />
        </div>
      </div>

      {/* Memory list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <p style={{
            fontSize: 12, color: 'var(--c-text-faint)', textAlign: 'center',
            padding: '16px 14px', fontFamily: 'var(--font-mono)',
          }}>
            {memories.length === 0 ? 'No memories stored yet' : 'No results'}
          </p>
        ) : (
          filtered.map((m, idx) => {
            const tag = m.tag || inferTag(m);
            const tc = TAG_COLORS[tag] || TAG_COLORS.skill;
            const text = m.text || m.memory || '';
            const ts = m.ts || (m.metadata?.timestamp ? new Date(m.metadata.timestamp).toLocaleDateString() : '');
            return (
              <div
                key={m.id || idx}
                style={{
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--c-divider)',
                  display: 'flex', flexDirection: 'column', gap: 5,
                }}
              >
                <div style={{
                  fontSize: 12, color: 'var(--c-text-mid)', lineHeight: 1.55,
                  fontFamily: 'var(--font-sans)',
                }}>
                  {text}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.07em',
                    color: tc.color, background: tc.bg,
                    border: `1px solid ${tc.border}`, borderRadius: 3, padding: '1px 6px',
                  }}>
                    {tag}
                  </span>
                  {ts && (
                    <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {ts}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--c-divider)',
        display: 'flex', gap: 6,
      }}>
        <button style={{
          flex: 1, padding: '6px 0', background: 'transparent',
          border: '1px solid var(--c-divider)',
          borderRadius: 4, color: 'var(--c-text-lo)', fontSize: 11, cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}>
          Clear All
        </button>
        <button style={{
          flex: 1, padding: '6px 0', background: 'transparent',
          border: '1px solid rgba(78,201,176,0.3)',
          borderRadius: 4, color: 'var(--c-teal)', fontSize: 11, cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}>
          Export
        </button>
      </div>
    </div>
  );
}
