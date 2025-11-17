import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X, Settings, Plus, Sun, Moon, Wifi, WifiOff } from 'lucide-react';
import { PageType, DocumentWithStatus } from './types';
import { useTheme, useSettings, useChatHistory, useChat } from './hooks';
import { apiClient } from './utils/api';
import { SyncProvider, useSyncContext } from './contexts/SyncContext';
import './styles/globals.css';
import './styles/utils.css'; 
import { 
  ChatWindow, 
  MessageInput, 
  ChatControls, 
  Sidebar, 
  SettingsPage,
  UsernameModal
} from './components/index';

function AppContent() {
  const { isDark, setIsDark } = useTheme();
  const { settings, updateSetting } = useSettings();
  const { 
    username, 
    setUsername, 
    setIsSyncing,
    setLastSyncTime,
    setUnsyncedCount
  } = useSyncContext();
  
  const {
    chats,
    currentChatId,
    setCurrentChatId,
    createNewChat,
    updateChat,
    deleteChat,
    getCurrentChat,
    syncFromBackend,
    syncUnsyncedChats,
    isSyncing,
    isInitialSyncComplete,
    unsyncedCount,
  } = useChatHistory(username || undefined);
  const { messages, setMessages, isLoading, sendMessage, cleanup } =
    useChat();

  const [currentPage, setCurrentPage] = useState<PageType>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadedDocs, setUploadedDocs] = useState<DocumentWithStatus[]>([]);
  const [searchMode, setSearchMode] = useState('normal');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null!);
  const isLoadingChatRef = useRef(false);

  const currentChat = getCurrentChat();

  // Initialize app - check for username and trigger initial sync
  useEffect(() => {
    const initialize = async () => {
      // Check if username exists
      if (!username) {
        setShowUsernameModal(true);
        setIsInitializing(false);
        return;
      }

      // Username exists, ensure user exists in backend and sync
      try {
        setIsSyncing(true);
        // Create or get user (idempotent - returns existing user if already exists)
        await apiClient.createUser(username);
        await syncFromBackend();
        await syncUnsyncedChats();
        setLastSyncTime(Date.now());
      } catch (error) {
        console.error('Initial sync failed:', error);
      } finally {
        setIsSyncing(false);
        setIsInitializing(false);
      }
    };

    initialize();
  }, []); // Only run once on mount

  // Handle username submission from modal
  const handleUsernameSet = async (newUsername: string) => {
    setUsername(newUsername);
    setShowUsernameModal(false);
    setIsInitializing(true);

    // Create or get user in backend first
    try {
      setIsSyncing(true);
      await apiClient.createUser(newUsername);
      await syncFromBackend();
      setLastSyncTime(Date.now());
    } catch (error) {
      console.error('Initial sync failed:', error);
    } finally {
      setIsSyncing(false);
      setIsInitializing(false);
    }
  };

  // Update sync context when local state changes
  useEffect(() => {
    setUnsyncedCount(unsyncedCount);
  }, [unsyncedCount, setUnsyncedCount]);

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
      isLoadingChatRef.current = true;
      setMessages(currentChat.messages);
      setUploadedDocs(currentChat.documents);
      setSearchMode(currentChat.searchMode);
      // Reset the flag after a brief delay to allow state updates to settle
      setTimeout(() => {
        isLoadingChatRef.current = false;
      }, 0);
    }
  }, [currentChatId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Sync messages to chat history whenever they change (but not during chat loading)
  useEffect(() => {
    if (!isLoadingChatRef.current && currentChatId && messages.length > 0) {
      updateChat(currentChatId, {
        messages,
        searchMode: searchMode as any,
      });
    }
  }, [messages, currentChatId, searchMode]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!currentChatId || !username) return;

    await sendMessage(
      content,
      currentChatId,
      username,
      searchMode,
      uploadedDocs.map((d) => d.id),
      settings
    );

    // Note: messages state will be updated by useChat hook
    // We'll sync to chat history in a separate effect
  };

  const handleUploadDocument = async (files: FileList | null) => {
    if (!currentChatId || !files || !username) return;

    for (const file of Array.from(files)) {
      // Create temporary document with processing status
      const tempDoc: DocumentWithStatus = {
        id: `temp-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        contentType: file.type,
        status: 'uploading',
        progress: 0,
      };

      setUploadedDocs((prev) => [...prev, tempDoc]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('chatId', currentChatId);
        formData.append('userId', username);

        const result = await apiClient.uploadDocumentWithProgress(
          formData,
          (progressEvent) => {
            // Update document status in real-time as progress events arrive
            setUploadedDocs((prev) =>
              prev.map((doc) =>
                doc.id === tempDoc.id
                  ? {
                      ...doc,
                      status: progressEvent.stage,
                      progress: progressEvent.progress,
                      currentChunk: progressEvent.current_chunk,
                      totalChunks: progressEvent.total_chunks,
                    }
                  : doc
              )
            );
          }
        );

        // Replace temp document with final result
        setUploadedDocs((prev) =>
          prev.map((doc) =>
            doc.id === tempDoc.id
              ? { ...result, status: 'ready', progress: 100 }
              : doc
          )
        );

        // Update chat history with completed document
        updateChat(currentChatId, {
          documents: uploadedDocs
            .filter((d) => d.id !== tempDoc.id)
            .concat({ ...result, status: 'ready', progress: 100 })
            .map(({ status, progress, currentChunk, totalChunks, error, ...doc }) => doc), // Strip status fields for storage
        });
      } catch (error) {
        // Mark document as failed
        setUploadedDocs((prev) =>
          prev.map((doc) =>
            doc.id === tempDoc.id
              ? {
                  ...doc,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                }
              : doc
          )
        );

        console.error('Upload failed:', error);
      }
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

      {/* Username Modal */}
      {showUsernameModal && (
        <UsernameModal 
          onUsernameSet={handleUsernameSet}
          isLoading={isSyncing}
        />
      )}

      {/* Loading Overlay during initial sync */}
      {isInitializing && !showUsernameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-900 dark:text-gray-100 text-lg font-medium">
              Syncing your chats...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap AppContent in SyncProvider
export default function App() {
  const handleSyncTrigger = async () => {
    // This will be called by the SyncContext for manual/auto sync
    // The actual sync logic is in AppContent via useChatHistory
  };

  return (
    <SyncProvider onSyncTrigger={handleSyncTrigger}>
      <AppContent />
    </SyncProvider>
  );
}