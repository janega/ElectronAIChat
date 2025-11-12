import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Settings, Plus, Sun, Moon, Wifi, WifiOff } from 'lucide-react';
import { PageType, Document } from './types';
import { useTheme, useSettings, useChatHistory, useChat } from './hooks';
import { apiClient } from './utils/api';
import './styles/globals.css';
import './styles/utils.css'; 
import { 
  ChatWindow, 
  MessageInput, 
  ChatControls, 
  Sidebar, 
  SettingsPage 
} from './components/index';

export default function App() {
  const { isDark, setIsDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const {
    chats,
    currentChatId,
    setCurrentChatId,
    createNewChat,
    updateChat,
    deleteChat,
    getCurrentChat,
  } = useChatHistory();
  const { messages, setMessages, isLoading, sendMessage, cleanup } =
    useChat();

  const [currentPage, setCurrentPage] = useState<PageType>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadedDocs, setUploadedDocs] = useState<Document[]>([]);
  const [searchMode, setSearchMode] = useState('normal');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null!);

  const currentChat = getCurrentChat();

  // Check backend status
  const checkBackendStatus = async () => {
    try {
      await apiClient.checkStatus();
      setBackendConnected(true);
    } catch (error) {
      setBackendConnected(false);
    }
  };

  // Poll backend status every 30 seconds
  useEffect(() => {
    checkBackendStatus(); // Check immediately on load

    const interval = setInterval(checkBackendStatus, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Load current chat
  useEffect(() => {
    if (currentChat) {
      setMessages(currentChat.messages);
      setUploadedDocs(currentChat.documents);
      setSearchMode(currentChat.searchMode);
    }
  }, [currentChatId, currentChat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!currentChatId) return;

    await sendMessage(
      content,
      currentChatId,
      searchMode,
      uploadedDocs.map((d) => d.id),
      settings
    );

    updateChat(currentChatId, {
      messages,
      searchMode: searchMode as any,
    });
  };

  const handleUploadDocument = async (files: FileList | null) => {
    if (!currentChatId || !files) return;

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('chatId', currentChatId);
        formData.append('userId', 'default-user');

        const result = await apiClient.uploadDocument(formData);
        setUploadedDocs((prev) => [...prev, result.document]);
        updateChat(currentChatId, {
          documents: [...uploadedDocs, result.document],
        });
      }
    } catch (error) {
      alert(
        `Upload failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  };

  if (currentPage === 'settings') {
    return (
      <div className={`${isDark ? 'dark' : ''}`}>
        <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
          <Sidebar
            isOpen={sidebarOpen}
            chats={chats}
            currentChatId={currentChatId}
            onSelectChat={setCurrentChatId}
            onNewChat={createNewChat}
            onDeleteChat={deleteChat}
            isDark={isDark}
          />

          <div className="flex-1 flex flex-col">
            <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <h1 className="text-xl font-semibold">Settings</h1>

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      backendConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    title={backendConnected ? 'Connected' : 'Disconnected'}
                  />
                  <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {backendConnected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </div>
            </header>

            <SettingsPage
              isDark={isDark}
              onBack={() => setCurrentPage('chat')}
              settings={settings}
              onSettingChange={updateSetting}
              onTestBackend={checkBackendStatus}
              backendConnected={backendConnected}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar
          isOpen={sidebarOpen}
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={setCurrentChatId}
          onNewChat={createNewChat}
          onDeleteChat={deleteChat}
          isDark={isDark}
        />

        <div className="flex-1 flex flex-col">
          <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <h1 className="text-xl font-semibold">AI Chat</h1>

            <div className="flex items-center gap-2">
              <div className="relative group">
                <div
                  className={`w-3 h-3 rounded-full ${
                    backendConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  title={backendConnected ? 'Connected' : 'Disconnected'}
                />
                <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {backendConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setCurrentPage('settings')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <Settings size={20} />
              </button>
            </div>
          </header>

          {currentChatId ? (
            <>
              <ChatWindow
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                isDark={isDark}
              />

              <ChatControls
                uploadedDocs={uploadedDocs}
                searchMode={searchMode}
                onSearchModeChange={(mode) => {
                  setSearchMode(mode);
                  updateChat(currentChatId, { searchMode: mode as any });
                }}
                onUpload={handleUploadDocument}
                isLoading={isLoading}
                isExpanded={isInputExpanded}
                onToggleExpand={() => setIsInputExpanded(!isInputExpanded)}
              />

              <MessageInput
                onSend={handleSendMessage}
                isLoading={isLoading}
                isExpanded={isInputExpanded}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-4">Welcome to AI Chat with RAG</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Start a new conversation or select one from the sidebar.
                </p>
                <button
                  onClick={() => createNewChat()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
                >
                  <Plus size={20} />
                  New Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}