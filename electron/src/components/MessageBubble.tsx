import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { parseMessageContent, normalizeMarkdown } from '../utils/messageParser';

interface MessageBubbleProps {
  message: Message;
  isDark?: boolean;
  onRetry?: (message: Message) => void;
}

// Markdown renderer used for both final content and thinking blocks.
function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code: inline vs fenced block
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className ?? '');
          // Sanitise: allow only alphanumeric + hyphens to prevent unexpected values.
          const rawLang = match ? match[1] : '';
          const lang = /^[a-zA-Z0-9-]+$/.test(rawLang) ? rawLang : '';
          const isBlock = !!className;
          if (isBlock) {
            return (
              <SyntaxHighlighter
                language={lang || 'text'}
                style={vscDarkPlus}
                PreTag="div"
                customStyle={{
                  margin: '8px 0',
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(0,0,0,0.35)',
                }}
                codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          }
          return (
            <code
              className={className}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--c-orange)',
                background: 'rgba(206,145,120,0.1)',
                padding: '1px 5px',
                borderRadius: 3,
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
        // Headings
        h1: ({ children }) => (
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-hi)', margin: '12px 0 6px' }}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-hi)', margin: '10px 0 5px' }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-hi)', margin: '8px 0 4px' }}>
            {children}
          </h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p style={{ margin: '4px 0', lineHeight: 1.75 }}>{children}</p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul style={{ paddingLeft: 18, margin: '4px 0', listStyleType: 'disc' }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ paddingLeft: 18, margin: '4px 0', listStyleType: 'decimal' }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ marginBottom: 2, lineHeight: 1.75 }}>{children}</li>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote
            style={{
              borderLeft: '3px solid var(--c-teal)',
              paddingLeft: 12,
              margin: '6px 0',
              color: 'var(--c-text-lo)',
              fontStyle: 'italic',
            }}
          >
            {children}
          </blockquote>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--c-blue)', textDecoration: 'underline' }}
          >
            {children}
          </a>
        ),
        // Tables (via remark-gfm)
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '8px 0' }}>
            <table
              style={{
                borderCollapse: 'collapse',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                width: '100%',
              }}
            >
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th
            style={{
              border: '1px solid var(--c-border)',
              padding: '4px 10px',
              background: 'var(--c-raised)',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            style={{
              border: '1px solid var(--c-border)',
              padding: '4px 10px',
            }}
          >
            {children}
          </td>
        ),
        // Strong / em
        strong: ({ children }) => (
          <strong style={{ fontWeight: 600, color: 'var(--c-text-hi)' }}>{children}</strong>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = !!(message as any).streaming;
  const [showThinking, setShowThinking] = useState(false);

  // Parse the content to separate thinking blocks from final answer.
  const parsed = React.useMemo(
    () => parseMessageContent(message.content ?? ''),
    [message.content]
  );

  // Normalize the final content for safe markdown rendering during streaming.
  const finalText = normalizeMarkdown(parsed.finalContent);

  // Format timestamp
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      style={{
        padding: '16px 24px',
        display: 'flex',
        gap: 14,
        background: isUser ? 'transparent' : 'rgba(255,255,255,0.018)',
        borderBottom: '1px solid var(--c-divider)',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 4,
          flexShrink: 0,
          marginTop: 1,
          background: isUser ? 'var(--c-input)' : 'linear-gradient(135deg,#4EC9B0,#569CD6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: isUser ? 'var(--c-text-lo)' : 'var(--c-bg)',
        }}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Role + timestamp + streaming badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.03em',
              color: isUser ? 'var(--c-text-mid)' : 'var(--c-teal)',
            }}
          >
            {isUser ? 'user' : 'assistant'}
          </span>
          {timestamp && (
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>
              {timestamp}
            </span>
          )}
          {isStreaming && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--c-yellow)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                className="animate-pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--c-yellow)',
                  display: 'inline-block',
                }}
              />
              streaming
            </span>
          )}
        </div>

        {/* Thinking / reasoning blocks */}
        {parsed.hasThinking && (
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setShowThinking((v) => !v)}
              style={{
                background: 'transparent',
                border: '1px solid var(--c-border)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--c-text-lo)',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title={showThinking ? 'Hide thinking' : 'Show thinking'}
              aria-label={showThinking ? 'Hide thinking section' : 'Show thinking section'}
              aria-expanded={showThinking}
            >
              <span style={{ fontSize: 10 }}>{showThinking ? '▾' : '▸'}</span>
              {showThinking ? 'Hide thinking' : 'Show thinking'}
            </button>

            {showThinking && (
              <div
                style={{
                  marginTop: 6,
                  padding: '8px 12px',
                  borderLeft: '3px solid var(--c-text-faint)',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '0 4px 4px 0',
                  opacity: 0.8,
                }}
              >
                {parsed.thinkingBlocks.map((block, idx) => (
                  <div key={idx}>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--c-text-faint)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {block.tag}{block.isOpen ? ' (streaming…)' : ''}
                    </span>
                    {block.isOpen && (
                      <span aria-live="polite" className="sr-only">
                        {block.tag} section is still streaming
                      </span>
                    )}
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--c-text-lo)',
                        lineHeight: 1.65,
                        fontFamily: 'var(--font-sans)',
                        marginTop: 4,
                      }}
                    >
                      <MarkdownContent text={normalizeMarkdown(block.content)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message body */}
        <div
          style={{
            fontSize: 14,
            color: 'var(--c-text-mid)',
            lineHeight: 1.75,
            fontFamily: 'var(--font-sans)',
            wordBreak: 'break-word',
          }}
        >
          {finalText ? (
            <MarkdownContent text={finalText} />
          ) : (
            isStreaming && (
              <span
                className="animate-blink"
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 14,
                  background: 'var(--c-teal)',
                  verticalAlign: 'text-bottom',
                }}
              />
            )
          )}
        </div>

        {/* Source citations */}
        {message.sources && message.sources.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>
              sources:
            </span>
            {message.sources.map((src, idx) => (
              <span
                key={idx}
                title={src.type === 'memory' ? 'Retrieved from long-term memory' : `Document: ${src.filename}`}
                style={{
                  fontSize: 11,
                  color: 'var(--c-blue)',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(86,156,214,0.08)',
                  border: '1px solid rgba(86,156,214,0.2)',
                  borderRadius: 3,
                  padding: '2px 7px',
                  cursor: 'default',
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
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--c-text-lo)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
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
