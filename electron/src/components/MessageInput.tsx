import React, { useState, useRef } from 'react';

const SendIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const StopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);

// Browser / Globe icon for manual web search
const BrowserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// Bot / Robot icon for agentic search
const BotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/>
    <line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  isExpanded?: boolean;
  temperature?: number;
  maxTokens?: number;
  searchMode?: string;
  onSearchModeChange?: (mode: string) => void;
}

export function MessageInput({
  onSend,
  onStop,
  isLoading,
  temperature,
  maxTokens,
  searchMode = 'normal',
  onSearchModeChange,
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSearchModeToggle = (mode: string) => {
    if (onSearchModeChange) {
      onSearchModeChange(searchMode === mode ? 'normal' : mode);
    }
  };

  const isManualSearch = searchMode === 'manual_search';
  const isAgenticSearch = searchMode === 'agentic_search';

  return (
    <div style={{
      background: 'var(--c-surface)',
      borderTop: '1px solid var(--c-border)',
      padding: '12px 16px',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', gap: 8, background: 'var(--c-input)',
        borderRadius: 6, border: '1px solid var(--c-border)',
        padding: '10px 12px', alignItems: 'flex-end',
      }}>
        {/* Manual web search toggle */}
        <button
          onClick={() => handleSearchModeToggle('manual_search')}
          title={isManualSearch ? 'Manual web search ON (click to disable)' : 'Enable manual web search'}
          style={{
            background: 'transparent', border: 'none', borderRadius: 4,
            width: 26, height: 26, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            color: isManualSearch ? 'var(--c-teal)' : 'var(--c-text-faint)',
            opacity: isManualSearch ? 1 : 0.4,
            transition: 'color 0.15s, opacity 0.15s',
          }}
        >
          <BrowserIcon />
        </button>

        {/* Agentic search toggle */}
        <button
          onClick={() => handleSearchModeToggle('agentic_search')}
          title={isAgenticSearch ? 'Agentic web search ON (click to disable)' : 'Enable agentic web search'}
          style={{
            background: 'transparent', border: 'none', borderRadius: 4,
            width: 26, height: 26, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            color: isAgenticSearch ? 'var(--c-teal)' : 'var(--c-text-faint)',
            opacity: isAgenticSearch ? 1 : 0.4,
            transition: 'color 0.15s, opacity 0.15s',
          }}
        >
          <BotIcon />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something…"
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--c-text-mid)', fontSize: 14, fontFamily: 'var(--font-sans)',
            resize: 'none', lineHeight: 1.6, minHeight: 21, maxHeight: 200,
            overflowY: 'auto',
          }}
        />
        {isLoading && onStop ? (
          <button
            onClick={onStop}
            title="Stop generation"
            style={{
              background: 'var(--c-red)', border: 'none', borderRadius: 4,
              width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              color: 'var(--c-bg)',
            }}
          >
            <StopIcon />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            title="Send message"
            style={{
              background: input.trim() ? 'var(--c-teal)' : 'var(--c-input)',
              border: 'none', borderRadius: 4,
              width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              color: input.trim() ? 'var(--c-bg)' : 'var(--c-text-faint)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <SendIcon />
          </button>
        )}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 7, paddingLeft: 2,
      }}>
        <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>
          ⏎ send · ⇧⏎ newline
        </span>
        {(temperature !== undefined || maxTokens !== undefined) && (
          <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>
            {temperature !== undefined && `temp: ${temperature}`}
            {temperature !== undefined && maxTokens !== undefined && ' · '}
            {maxTokens !== undefined && `max_tokens: ${maxTokens}`}
          </span>
        )}
      </div>
    </div>
  );
}

