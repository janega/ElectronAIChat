import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X, Settings, Plus, Sun, Moon, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { PageType, DocumentWithStatus, Message } from './types';
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
  const { settings, updateSetting, saveStatus, saveError, loadSettingsFromBackend, saveSettingsToBackend } = useSettings();
  const { 
    username, 
    userId,
    setUsername,
    setUserId,
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
    updateChatMessage,
    deleteChat,
    getCurrentChat,
    syncFromBackend,
    syncUnsyncedChats,
    isSyncing,
    isInitialSyncComplete,
    unsyncedCount,
    generateTitleIfNeeded,
  } = useChatHistory(userId || undefined);
  const { messages, setMessages, isLoading, sendMessage, stopStream, cleanup } =
    useChat();

  const [currentPage, setCurrentPage] = useState<PageType>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadedDocs, setUploadedDocs] = useState<DocumentWithStatus[]>([]);
  const [searchMode, setSearchMode] = useState('normal');
  const [useMemory, setUseMemory] = useState(true);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null!);

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

      // Username exists, ensure user exists in backend and get user ID
      try {
        setIsSyncing(true);
        // Create or get user (idempotent - returns existing user if already exists)
        const userResponse = await apiClient.createUser(username);
        setUserId(userResponse.id); // Store user ID
        
        // Load user settings from backend
        await loadSettingsFromBackend(userResponse.id);
        
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
    setIsInitializing(true);

    // Create or get user in backend first
    try {
      setIsSyncing(true);
      console.log('[App] Creating user in backend:', newUsername);
      const userResponse = await apiClient.createUser(newUsername);
      console.log('[App] User created/retrieved:', userResponse);
      
      // Store both username and user ID (context handles localStorage)
      setUsername(newUsername);
      setUserId(userResponse.id);
      
      // Load user settings from backend after user creation
      await loadSettingsFromBackend(userResponse.id);
      
      await syncFromBackend();
      await syncUnsyncedChats(); // Sync any local-only chats created before username was set
      setLastSyncTime(Date.now());
      
      // Only close modal after successful initialization
      setShowUsernameModal(false);
    } catch (error) {
      console.error('[App] Initial sync failed:', error);
      // Show error to user and don't close modal
      alert(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}\n\nPlease check that the backend is running.`);
      setIsInitializing(false);
      setIsSyncing(false);
      return; // Don't close modal on error
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

  // Sync visible messages from chat history - THIS IS THE SINGLE SOURCE OF TRUTH
  // Runs whenever chats array updates OR currentChatId changes
  useEffect(() => {
    if (currentChat) {
      console.log('[App] Syncing visible messages from chat history:', currentChat.id, {
        messageCount: currentChat.messages.length,
        isStreaming: currentChat.isStreaming
      });
      
      // Always sync from chat history - this is the single source of truth
      setMessages([...currentChat.messages]); // Create new array to ensure React detects change
      setUploadedDocs(currentChat.documents.map(doc => ({ ...doc, status: 'ready' as const, progress: 100 })));
      setSearchMode(currentChat.searchMode);
    }
  }, [currentChatId, chats]); // Watch BOTH currentChatId AND chats array

  // Note: isStreaming is now cleared via the stream callback's isDone flag
  // This ensures the correct chat's flag is cleared, not just the current one

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!currentChatId || !username) return;

    // Capture the chatId for stream updates (before any async operations)
    const streamChatId = currentChatId;

    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      searchMode: searchMode as any,
      timestamp: new Date().toISOString(),
    };

    // ONLY update chat history - visible messages will sync via effect
    updateChatMessage(streamChatId, userMessage);

    // Mark chat as streaming
    updateChat(streamChatId, { isStreaming: true });

    // Use serverChatId for backend API calls, fallback to local ID
    const backendChatId = currentChat?.serverChatId || streamChatId;
    
    console.log('[Send Message] Sending to chat:', {
      localId: streamChatId,
      serverChatId: currentChat?.serverChatId,
      backendChatId,
      isSynced: currentChat?.isSynced
    });
    
    await sendMessage(
      content,
      backendChatId,
      userId!,
      searchMode,
      useMemory,
      uploadedDocs.map((d) => d.id),
      settings,
      false, // skipUserMessage
      (chatId: string, aiMessage: Message, isDone: boolean) => {
        console.log('[Stream Update] Updating chat history for:', streamChatId, {
          messageId: aiMessage.id,
          isDone,
          contentLength: aiMessage.content.length
        });
        
        // ONLY update chat history - visible messages sync automatically via effect
        if (!isDone || aiMessage.content) {
          updateChatMessage(streamChatId, aiMessage);
        }
        
        // Clear isStreaming flag when stream completes
        if (isDone) {
          console.log('[Stream Update] Stream completed for chat:', streamChatId);
          updateChat(streamChatId, { isStreaming: false });
          
          // Check for title update after EVERY message if still "New Chat"
          // Backend generates title after 4 messages (2 exchanges)
          const chat = chats.find(c => c.id === streamChatId);
          if (chat?.title === 'New Chat' && chat.serverChatId) {
            console.log('[Title Check] Polling for title update (current: "New Chat")');
            
            // Single poll after 2.5s delay - if not ready, next message will catch it
            setTimeout(async () => {
              try {
                const updatedChat = await apiClient.getChatDetail(chat.serverChatId!);
                if (updatedChat.title !== 'New Chat') {
                  updateChat(streamChatId, { title: updatedChat.title });
                  console.log('[Title Check] ✅ Updated title:', updatedChat.title);
                } else {
                  console.log('[Title Check] ⏳ Title not ready yet (will check on next message)');
                }
              } catch (error) {
                console.error('[Title Check] ❌ Failed to fetch title:', error);
              }
            }, 2500); // 2.5 second delay for backend title generation
          }
        }
      }
    );

    // Note: isStreaming will be cleared by the effect watching isLoading
    // messages state will be updated by useChat hook
  };

  const handleNewChat = async () => {
    if (!userId) {
      alert('Please set your username first');
      return;
    }

    setIsCreatingChat(true);
    try {
      await createNewChat();
    } catch (error) {
      console.error('[App] Failed to create chat:', error);
      alert(`Failed to create chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSelectChat = (chatId: string) => {
    // Don't switch if already on this chat
    if (chatId === currentChatId) return;
    
    // Just switch - no need to save messages, they're already in chat history
    console.log('[Chat Switch] Switching from', currentChatId, 'to', chatId);
    setCurrentChatId(chatId);
  };

  const handleRetryMessage = async (userMessage: Message) => {
    if (!currentChatId || !username || userMessage.role !== 'user') return;

    // Remove any AI response that came after this message (if it failed)
    const messageIndex = messages.findIndex((m) => m.id === userMessage.id);
    if (messageIndex !== -1 && messageIndex < messages.length - 1) {
      const nextMessage = messages[messageIndex + 1];
      if (nextMessage.role === 'assistant') {
        setMessages((prev) => prev.filter((m) => m.id !== nextMessage.id));
      }
    }

    // Mark chat as streaming
    updateChat(currentChatId, { isStreaming: true });

    // Use serverChatId for backend API calls, fallback to local ID
    const backendChatId = currentChat?.serverChatId || currentChatId;
    
    console.log('[Retry Message] Retrying for chat:', {
      localId: currentChatId,
      serverChatId: currentChat?.serverChatId,
      backendChatId,
      messageContent: userMessage.content.substring(0, 50)
    });

    // Capture the chatId for stream updates
    const streamChatId = currentChatId;
    
    // Resend WITHOUT adding a new user message (the original user message stays)
    await sendMessage(
      userMessage.content,
      backendChatId,
      userId!,
      searchMode,
      useMemory,
      uploadedDocs.map((d) => d.id),
      settings,
      true, // skipUserMessage = true for retry
      (chatId: string, aiMessage: Message, isDone: boolean) => {
        console.log('[Retry Stream Update] Updating chat history for:', streamChatId, {
          messageId: aiMessage.id,
          isDone,
          contentLength: aiMessage.content.length
        });
        
        // ONLY update chat history - visible messages sync automatically via effect
        if (!isDone || aiMessage.content) {
          updateChatMessage(streamChatId, aiMessage);
        }
        
        // Clear isStreaming flag when stream completes
        if (isDone) {
          console.log('[Retry Stream Update] Stream completed for chat:', streamChatId);
          updateChat(streamChatId, { isStreaming: false });
          
          // Check for title update (same logic as regular send)
          const chat = chats.find(c => c.id === streamChatId);
          if (chat?.title === 'New Chat' && chat.serverChatId) {
            console.log('[Title Check] Polling for title update after retry');
            
            setTimeout(async () => {
              try {
                const updatedChat = await apiClient.getChatDetail(chat.serverChatId!);
                if (updatedChat.title !== 'New Chat') {
                  updateChat(streamChatId, { title: updatedChat.title });
                  console.log('[Title Check] ✅ Updated title:', updatedChat.title);
                } else {
                  console.log('[Title Check] ⏳ Title not ready yet (will check on next message)');
                }
              } catch (error) {
                console.error('[Title Check] ❌ Failed to fetch title:', error);
              }
            }, 2500);
          }
        }
      }
    );

    // Note: isStreaming will be cleared by the effect watching isLoading
  };

  const handleStopStream = () => {
    if (currentChatId) {
      console.log('[App] Stopping stream for chat:', currentChatId);
      stopStream(currentChatId);
      updateChat(currentChatId, { isStreaming: false });
    }
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
            onSelectChat={handleSelectChat}
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
              userId={userId}
              saveStatus={saveStatus}
              saveError={saveError}
              onSaveSettings={() => userId && saveSettingsToBackend(userId)}
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
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={deleteChat}
          isDark={isDark}
          isCreatingChat={isCreatingChat}
        />

        <div className="flex-1 flex flex-col">
          <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <h1 className="text-xl font-semibold">Welcome {username}</h1>

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
                onRetryMessage={handleRetryMessage}
              />

              <ChatControls
                uploadedDocs={uploadedDocs}
                searchMode={searchMode}
                onSearchModeChange={(mode) => {
                  setSearchMode(mode);
                  updateChat(currentChatId, { searchMode: mode as any });
                }}
                useMemory={useMemory}
                onUseMemoryChange={setUseMemory}
                onUpload={handleUploadDocument}
                isLoading={isLoading}
                isExpanded={isInputExpanded}
                onToggleExpand={() => setIsInputExpanded(!isInputExpanded)}
              />

              <MessageInput
                onSend={handleSendMessage}
                onStop={handleStopStream}
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
                  onClick={handleNewChat}
                  disabled={isCreatingChat}
                  className={`px-6 py-3 rounded-lg transition flex items-center gap-2 mx-auto ${
                    isCreatingChat
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isCreatingChat ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      New Chat
                    </>
                  )}
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