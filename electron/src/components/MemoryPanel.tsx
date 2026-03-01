import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, MemoryEntry } from '../utils/api';

const TAG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  preference: { color: 'var(--c-teal)', bg: 'rgba(78,201,176,0.1)', border: 'rgba(78,201,176,0.2)' },
  context:    { color: 'var(--c-blue)', bg: 'rgba(86,156,214,0.1)', border: 'rgba(86,156,214,0.2)' },
  skill:      { color: 'var(--c-yellow)', bg: 'rgba(220,220,170,0.1)', border: 'rgba(220,220,170,0.2)' },
  config:     { color: 'var(--c-orange)', bg: 'rgba(206,145,120,0.1)', border: 'rgba(206,145,120,0.2)' },
};

const BrainIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5C12 3.34 10.66 2 9 2a3 3 0 0 0-3 3c0 .35.06.69.17 1A3 3 0 0 0 4 9a3 3 0 0 0 1.17 2.37A3 3 0 0 0 6 14a3 3 0 0 0 3 3h1"/>
    <path d="M12 5c0-1.66 1.34-3 3-3a3 3 0 0 1 3 3c0 .35-.06.69-.17 1A3 3 0 0 1 20 9a3 3 0 0 1-1.17 2.37A3 3 0 0 1 18 14a3 3 0 0 1-3 3h-1"/>
    <path d="M9 17v1a3 3 0 0 0 6 0v-1"/>
    <line x1="12" y1="5" x2="12" y2="17"/>
  </svg>
);

const PencilIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

interface MemoryPanelProps {
  userId?: string | null;
}

export function MemoryPanel({ userId }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editText, setEditText] = useState('');
  const [savingId, setSavingId] = useState<string | number | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getMemories(userId);
      setMemories(data.memories || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const filtered = memories.filter((m) => {
    const text = m.text || m.memory || '';
    return text.toLowerCase().includes(search.toLowerCase());
  });

  // Derive stats
  const factCount = memories.length;
  const sessionSet = new Set(memories.map((m) => m.metadata?.chatId ?? m.metadata?.chat_id).filter(Boolean));
  const sessionCount = sessionSet.size || 0;
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

  const startEdit = (m: MemoryEntry) => {
    setEditingId(m.id);
    setEditText(m.text || m.memory || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (m: MemoryEntry) => {
    if (!editText.trim()) return;
    setSavingId(m.id);
    try {
      await apiClient.updateMemory(String(m.id), editText.trim());
      setMemories((prev) =>
        prev.map((entry) =>
          entry.id === m.id ? { ...entry, memory: editText.trim(), text: editText.trim() } : entry
        )
      );
      setEditingId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to save memory');
    } finally {
      setSavingId(null);
    }
  };

  const deleteOne = async (m: MemoryEntry) => {
    try {
      await apiClient.deleteMemory(String(m.id));
      setMemories((prev) => prev.filter((entry) => entry.id !== m.id));
    } catch (e: any) {
      setError(e.message || 'Failed to delete memory');
    }
  };

  const clearAll = async () => {
    if (!userId) return;
    if (!window.confirm('Delete all memories? This cannot be undone.')) return;
    try {
      await apiClient.clearAllMemories(userId);
      setMemories([]);
    } catch (e: any) {
      setError(e.message || 'Failed to clear memories');
    }
  };

  const iconBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 3,
    color: 'var(--c-text-lo)',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  };

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
          fontFamily: 'var(--font-mono)', flex: 1,
        }}>
          Memory
        </span>
        <button
          onClick={fetchMemories}
          title="Refresh memories"
          style={{ ...iconBtnStyle, marginLeft: 'auto' }}
        >
          <RefreshIcon />
        </button>
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

      {/* Error banner */}
      {error && (
        <div style={{
          margin: '0 12px 6px', padding: '6px 8px', borderRadius: 4,
          background: 'rgba(206,145,120,0.1)', border: '1px solid rgba(206,145,120,0.3)',
          fontSize: 11, color: 'var(--c-orange)', fontFamily: 'var(--font-mono)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ ...iconBtnStyle, color: 'var(--c-orange)' }}>
            <XIcon />
          </button>
        </div>
      )}

      {/* Memory list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <p style={{
            fontSize: 12, color: 'var(--c-text-faint)', textAlign: 'center',
            padding: '16px 14px', fontFamily: 'var(--font-mono)',
          }}>
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p style={{
            fontSize: 12, color: 'var(--c-text-faint)', textAlign: 'center',
            padding: '16px 14px', fontFamily: 'var(--font-mono)',
          }}>
            {!userId
              ? 'Sign in to view memories'
              : memories.length === 0
              ? 'No memories stored yet'
              : 'No results'}
          </p>
        ) : (
          filtered.map((m, idx) => {
            const tag = m.tag || inferTag(m);
            const tc = TAG_COLORS[tag] || TAG_COLORS.skill;
            const text = m.text || m.memory || '';
            const ts = m.ts || (m.metadata?.timestamp ? new Date(m.metadata.timestamp).toLocaleDateString() : '');
            const isEditing = editingId === m.id;
            return (
              <div
                key={m.id || idx}
                style={{
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--c-divider)',
                  display: 'flex', flexDirection: 'column', gap: 5,
                }}
              >
                {isEditing ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                      rows={3}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--c-input)', border: '1px solid var(--c-border)',
                        borderRadius: 4, padding: '4px 6px', resize: 'vertical',
                        color: 'var(--c-text-mid)', fontSize: 12, fontFamily: 'var(--font-sans)',
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => saveEdit(m)}
                        disabled={savingId === m.id}
                        title="Save"
                        style={{ ...iconBtnStyle, color: 'var(--c-teal)' }}
                      >
                        <CheckIcon />
                      </button>
                      <button onClick={cancelEdit} title="Cancel" style={iconBtnStyle}>
                        <XIcon />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {ts && (
                          <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)', marginRight: 4 }}>
                            {ts}
                          </span>
                        )}
                        <button onClick={() => startEdit(m)} title="Edit" style={iconBtnStyle}>
                          <PencilIcon />
                        </button>
                        <button onClick={() => deleteOne(m)} title="Delete" style={{ ...iconBtnStyle, color: 'rgba(206,145,120,0.8)' }}>
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </>
                )}
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
        <button
          onClick={clearAll}
          disabled={!userId || memories.length === 0}
          style={{
            flex: 1, padding: '6px 0', background: 'transparent',
            border: '1px solid var(--c-divider)',
            borderRadius: 4, color: 'var(--c-text-lo)', fontSize: 11, cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            opacity: (!userId || memories.length === 0) ? 0.5 : 1,
          }}
        >
          Clear All
        </button>
        <button
          onClick={() => {
            const data = JSON.stringify(memories, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'memories.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={memories.length === 0}
          style={{
            flex: 1, padding: '6px 0', background: 'transparent',
            border: '1px solid rgba(78,201,176,0.3)',
            borderRadius: 4, color: 'var(--c-teal)', fontSize: 11, cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            opacity: memories.length === 0 ? 0.5 : 1,
          }}
        >
          Export
        </button>
      </div>
    </div>
  );
}
