import React, { useRef } from 'react';
import { DocumentWithStatus } from '../types';

interface DocsPanelProps {
  uploadedDocs: DocumentWithStatus[];
  searchMode: string;
  onSearchModeChange: (mode: string) => void;
  onUpload: (files: FileList) => void;
  isLoading: boolean;
}

function statusDotColor(status: string): string {
  if (status === 'ready') return 'var(--c-teal)';
  if (status === 'error') return 'var(--c-red)';
  return 'var(--c-yellow)'; // uploading/processing states
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DocIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const SEARCH_MODES = [
  { value: 'normal', label: 'LLM' },
  { value: 'embeddings', label: 'RAG' },
  { value: 'all', label: 'ALL' },
];

export function DocsPanel({ uploadedDocs, searchMode, onSearchModeChange, onUpload, isLoading }: DocsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <span style={{ color: 'var(--c-text-lo)' }}><DocIcon /></span>
        <span style={{
          fontSize: 12, color: 'var(--c-text-mid)', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}>
          Documents
        </span>
      </div>

      {/* Search mode switcher */}
      <div style={{ padding: '10px 14px 8px' }}>
        <div style={{
          fontSize: 11, color: 'var(--c-text-faint)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6,
        }}>
          SEARCH MODE
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SEARCH_MODES.map(({ value, label }) => {
            const isActive = searchMode === value;
            return (
              <button
                key={value}
                onClick={() => onSearchModeChange(value)}
                style={{
                  flex: 1, padding: '5px 0',
                  fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
                  borderRadius: 3, letterSpacing: '0.05em',
                  background: isActive ? 'rgba(78,201,176,0.12)' : 'transparent',
                  border: isActive ? '1px solid var(--c-teal)' : '1px solid var(--c-input)',
                  color: isActive ? 'var(--c-teal)' : 'var(--c-text-lo)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--c-divider)' }} />

      {/* Document list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {uploadedDocs.length === 0 ? (
          <p style={{
            fontSize: 12, color: 'var(--c-text-faint)', textAlign: 'center',
            padding: '16px 14px', fontFamily: 'var(--font-mono)',
          }}>
            No documents uploaded
          </p>
        ) : (
          uploadedDocs.map((doc) => {
            const dot = statusDotColor(doc.status);
            const isProcessing = doc.status !== 'ready' && doc.status !== 'error';
            return (
              <div
                key={doc.id}
                style={{
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--c-divider)',
                  cursor: 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: dot, flexShrink: 0, display: 'inline-block',
                  }} />
                  <span style={{
                    fontSize: 12, color: 'var(--c-text-mid)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {doc.name}
                  </span>
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--c-text-faint)',
                  fontFamily: 'var(--font-mono)', paddingLeft: 13, display: 'flex', gap: 10,
                }}>
                  <span>{humanSize(doc.size)}</span>
                  {isProcessing ? (
                    <span style={{ color: 'var(--c-yellow)' }}>
                      {doc.progress !== undefined ? `${Math.round(doc.progress)}%` : 'processing…'}
                    </span>
                  ) : doc.chunks !== undefined ? (
                    <span>{doc.chunks} chunks</span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upload zone */}
      <div style={{ padding: '10px 12px' }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx,.json,.py"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
          disabled={isLoading}
          style={{ display: 'none' }}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 5, padding: '16px 10px',
            textAlign: 'center', cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(78,201,176,0.35)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
        >
          <div style={{ fontSize: 19, color: 'var(--c-text-faint)', marginBottom: 4 }}>↑</div>
          <div style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>Drop files or click to upload</div>
          <div style={{ fontSize: 11, color: 'var(--c-text-faint)', marginTop: 2, opacity: 0.6 }}>
            PDF · TXT · MD · DOCX · JSON · PY
          </div>
        </div>
      </div>
    </div>
  );
}
