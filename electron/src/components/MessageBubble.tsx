import React, { useEffect } from 'react';
import { Message } from '../types';
import { RefreshCw, AlertCircle, FileText, Brain } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isDark: boolean;
  onRetry?: (message: Message) => void;
}

export function MessageBubble({ message, isDark, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasError = message.error || (message.content.startsWith('Error:') && message.role === 'assistant');

  // Debug logging for sources
  useEffect(() => {
    if (message.role === 'assistant') {
      console.log('[MessageBubble] Rendering message:', {
        id: message.id,
        hasSources: !!message.sources,
        sourcesLength: message.sources?.length,
        sources: message.sources,
      });
    }
  }, [message]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : hasError
            ? 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 border border-red-300 dark:border-red-700 rounded-bl-none'
            : `${isDark ? 'bg-gray-800' : 'bg-gray-200'} text-gray-900 dark:text-gray-100 rounded-bl-none`
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        
        {/* Document Sources Attribution */}
        {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
          <div className={`mt-2 pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
            <p className="text-xs font-medium opacity-70 mb-1">Sources:</p>
            <div className="flex flex-wrap gap-1">
              {message.sources.map((source, idx) => {
                const isMemory = source.type === 'memory';
                const Icon = isMemory ? Brain : FileText;
                const tooltipText = isMemory 
                  ? 'Retrieved from long-term memory' 
                  : `Document: ${source.filename}`;
                
                return (
                  <span
                    key={idx}
                    className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                      isDark 
                        ? 'bg-gray-700 text-gray-300' 
                        : 'bg-gray-300 text-gray-700'
                    }`}
                    title={tooltipText}
                  >
                    <Icon size={12} />
                    <span>{source.filename}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        
        {message.role === 'user' && onRetry && (
          <div className="mt-2 pt-2 border-t border-blue-400 dark:border-blue-500 flex items-center gap-2">
            <button
              onClick={() => onRetry(message)}
              disabled={message.isRetrying}
              className="flex items-center gap-1 text-xs font-medium text-blue-100 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Retry sending this message"
            >
              <RefreshCw size={12} className={message.isRetrying ? 'animate-spin' : ''} />
              {message.isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        )}
        
        {/* Metadata for assistant messages */}
        {message.role === 'assistant' && (message.modelUsed || message.tokensUsed || message.responseTime) && (
          <div className={`mt-2 pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
            <div className="flex flex-wrap gap-2 text-xs opacity-70">
              {message.modelUsed && (
                <span title="Model used">
                  🤖 {message.modelUsed}
                </span>
              )}
              {message.tokensUsed && (
                <span title="Tokens used">
                  🔢 {message.tokensUsed} tokens
                </span>
              )}
              {message.responseTime && (
                <span title="Response time">
                  ⏱️ {message.responseTime.toFixed(2)}s
                </span>
              )}
            </div>
          </div>
        )}
        
        {message.searchMode && (
          <p className="text-xs mt-1 opacity-70">
            Search: {message.searchMode}
          </p>
        )}
      </div>
    </div>
  );
}