import React from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isDark?: boolean;
  onRetry?: (message: Message) => void;
}

// Simple markdown renderer for bold (**text**) and inline code (`code`)
function renderContent(content: string, isStreaming: boolean) {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} style={{ color: '#E8E8E8', fontWeight: 600 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: '#CE9178',
                background: 'rgba(206,145,120,0.1)',
                padding: '1px 5px', borderRadius: 3,
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
      {isStreaming && (
        <span
          className="animate-blink"
          style={{
            display: 'inline-block', width: 2, height: 14,
            background: '#4EC9B0', marginLeft: 2, verticalAlign: 'text-bottom',
          }}
        />
      )}
    </>
  );
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = !!(message as any).streaming;

  // Format timestamp
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      style={{
        padding: '16px 24px', display: 'flex', gap: 14,
        background: isUser ? 'transparent' : 'rgba(255,255,255,0.018)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 26, height: 26, borderRadius: 4, flexShrink: 0, marginTop: 1,
          background: isUser ? '#3C3C3C' : 'linear-gradient(135deg,#4EC9B0,#569CD6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: isUser ? '#858585' : '#1E1E1E',
        }}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Role + timestamp + streaming badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            letterSpacing: '0.03em', color: isUser ? '#CCCCCC' : '#4EC9B0',
          }}>
            {isUser ? 'user' : 'assistant'}
          </span>
          {timestamp && (
            <span style={{ fontSize: 10, color: '#555555', fontFamily: 'var(--font-mono)' }}>
              {timestamp}
            </span>
          )}
          {isStreaming && (
            <span style={{
              fontSize: 10, color: '#DCDCAA', fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span
                className="animate-pulse-dot"
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#DCDCAA', display: 'inline-block',
                }}
              />
              streaming
            </span>
          )}
        </div>

        {/* Message body */}
        <div style={{
          fontSize: 13, color: '#D4D4D4', lineHeight: 1.75,
          fontFamily: 'var(--font-sans)', wordBreak: 'break-word',
        }}>
          {message.content ? renderContent(message.content, isStreaming) : (
            isStreaming ? (
              <span
                className="animate-blink"
                style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#4EC9B0', verticalAlign: 'text-bottom',
                }}
              />
            ) : null
          )}
        </div>

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#555555', fontFamily: 'var(--font-mono)' }}>
              sources:
            </span>
            {message.sources.map((src, idx) => (
              <span
                key={idx}
                title={src.type === 'memory' ? 'Retrieved from long-term memory' : `Document: ${src.filename}`}
                style={{
                  fontSize: 10, color: '#569CD6',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(86,156,214,0.08)',
                  border: '1px solid rgba(86,156,214,0.2)',
                  borderRadius: 3, padding: '2px 7px', cursor: 'default',
                }}
              >
                {src.filename}
              </span>
            ))}
          </div>
        )}

        {/* Retry button for user messages */}
        {isUser && onRetry && (
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => onRetry(message)}
              disabled={(message as any).isRetrying}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 10, color: '#858585', fontFamily: 'var(--font-mono)',
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                opacity: (message as any).isRetrying ? 0.5 : 1,
              }}
              title="Retry sending this message"
            >
              ↺ {(message as any).isRetrying ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
