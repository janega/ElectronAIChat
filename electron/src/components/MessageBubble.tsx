import React from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isDark: boolean;
}

export function MessageBubble({ message, isDark }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : `${isDark ? 'bg-gray-800' : 'bg-gray-200'} text-gray-900 dark:text-gray-100 rounded-bl-none`
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        {message.searchMode && (
          <p className="text-xs mt-1 opacity-70">
            Search: {message.searchMode}
          </p>
        )}
      </div>
    </div>
  );
}