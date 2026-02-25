import React from 'react';
import { Message } from '../types';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isDark?: boolean;
  onRetryMessage?: (message: Message) => void;
}

export function ChatWindow({
  messages,
  isLoading,
  messagesEndRef,
  onRetryMessage,
}: ChatWindowProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#1E1E1E' }}>
      {messages.length === 0 ? (
        <div style={{
          height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <p style={{ fontSize: 13, color: '#555555', fontFamily: 'var(--font-mono)' }}>
            No messages yet. Start chatting!
          </p>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={onRetryMessage}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div style={{
              padding: '16px 24px', display: 'flex', gap: 14,
              background: 'rgba(255,255,255,0.018)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                background: 'linear-gradient(135deg,#4EC9B0,#569CD6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#1E1E1E',
              }}>
                AI
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 4 }}>
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div
                    key={i}
                    className="animate-bounce"
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#4EC9B0', animationDelay: `${delay}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 24 }} ref={messagesEndRef} />
    </div>
  );
}
