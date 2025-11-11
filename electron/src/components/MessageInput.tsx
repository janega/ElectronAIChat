import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  isExpanded?: boolean;
}

export function MessageInput({ onSend, isLoading, isExpanded = false }: MessageInputProps) {
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
    <div className={`border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 ${isExpanded ? 'flex-1 flex flex-col' : ''}`}>
      <div className={`flex gap-3 ${isExpanded ? 'flex-1' : ''}`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={isLoading}
          rows={isExpanded ? 10 : 1}
          className={`flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none ${isExpanded ? 'overflow-y-auto' : ''}`}
          style={isExpanded ? { minHeight: '200px', maxHeight: '100%' } : {}}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}