import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Chat } from '../types';

interface SidebarProps {
  isOpen: boolean;
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  isDark: boolean;
}

export function Sidebar({
  isOpen,
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  isDark,
}: SidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(256); // 16rem = 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) { // Min 200px, max 600px
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  return (
    <div
      ref={sidebarRef}
      className={`${
        isOpen ? '' : 'w-0'
      } transition-all duration-300 overflow-hidden bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col relative`}
      style={{ width: isOpen ? `${sidebarWidth}px` : '0px' }}
    >
      {/* Resize handle */}
      {isOpen && (
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-10"
          onMouseDown={handleResizeStart}
          style={{ cursor: 'col-resize' }}
        />
      )}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onNewChat}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chats.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            No chats yet
          </p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`p-3 rounded-lg cursor-pointer transition flex items-center justify-between group ${
                currentChatId === chat.id
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              <button
                onClick={() => onSelectChat(chat.id)}
                className="flex-1 text-left truncate text-sm relative group/title flex items-center gap-2"
                title={chat.title || 'Untitled'} // Native browser tooltip
              >
                {chat.isStreaming && (
                  <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
                )}
                <span className="truncate block flex-1">
                  {chat.title || 'Untitled'}
                </span>
                {/* Enhanced tooltip on hover */}
                {chat.title && chat.title.length > 20 && (
                  <span className="absolute left-0 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/title:opacity-100 transition-opacity pointer-events-none whitespace-normal max-w-xs z-20">
                    {chat.title}
                  </span>
                )}
              </button>
              <button
                onClick={() => onDeleteChat(chat.id)}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900 rounded transition flex-shrink-0"
                title="Delete chat"
              >
                <Trash2 size={16} className="text-red-600" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}