import React from 'react';
import { Message } from '../types';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isDark: boolean;
  onRetry?: (message: Message) => void;
}

export function MessageBubble({ message, isDark, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasError = message.error || (message.content.startsWith('Error:') && message.role === 'assistant');

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
        
        {message.searchMode && (
          <p className="text-xs mt-1 opacity-70">
            Search: {message.searchMode}
          </p>
        )}
      </div>
    </div>
  );
}