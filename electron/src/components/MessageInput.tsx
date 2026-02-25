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

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  isExpanded?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export function MessageInput({
  onSend,
  onStop,
  isLoading,
  temperature,
  maxTokens,
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

  return (
    <div style={{
      background: '#252526',
      borderTop: '1px solid #1A1A1A',
      padding: '12px 16px',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', gap: 8, background: '#3C3C3C',
        borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 12px', alignItems: 'flex-end',
      }}>
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
            color: '#D4D4D4', fontSize: 13, fontFamily: 'var(--font-sans)',
            resize: 'none', lineHeight: 1.6, minHeight: 21, maxHeight: 200,
            overflowY: 'auto',
          }}
        />
        {isLoading && onStop ? (
          <button
            onClick={onStop}
            title="Stop generation"
            style={{
              background: '#F44747', border: 'none', borderRadius: 4,
              width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              color: '#1E1E1E',
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
              background: input.trim() ? '#4EC9B0' : '#3C3C3C',
              border: 'none', borderRadius: 4,
              width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              color: input.trim() ? '#1E1E1E' : '#555555',
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
        <span style={{ fontSize: 10, color: '#555555', fontFamily: 'var(--font-mono)' }}>
          ⏎ send · ⇧⏎ newline
        </span>
        {(temperature !== undefined || maxTokens !== undefined) && (
          <span style={{ fontSize: 10, color: '#555555', fontFamily: 'var(--font-mono)' }}>
            {temperature !== undefined && `temp: ${temperature}`}
            {temperature !== undefined && maxTokens !== undefined && ' · '}
            {maxTokens !== undefined && `max_tokens: ${maxTokens}`}
          </span>
        )}
      </div>
    </div>
  );
}
