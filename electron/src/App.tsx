import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X, Settings, Plus, Sun, Moon, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { PageType, DocumentWithStatus, Message } from './types';
import { useTheme, useSettings, useChatHistory, useChat } from './hooks';
import { apiClient } from './utils/api';
import type { ModelInfo, ModelsResponse } from './utils/api';
import { SyncProvider, useSyncContext } from './contexts/SyncContext';
import './styles/globals.css';
import './styles/utils.css'; 
import { 
  ChatWindow, 
  MessageInput,
  ChatControls,
  ModelBar,
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
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchWarning, setSwitchWarning] = useState<string | null>(null);
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  // Track whether we have already attempted to restore the saved model for
  // the current session (so we only do it once per login, not on every poll).
  const modelRestoreAttempted = useRef(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [backendWarnings, setBackendWarnings] = useState<any[]>([]);
  const [showWarnings, setShowWarnings] = useState(true);

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

  // Check backend status and health warnings
  const checkBackendStatus = async () => {
    try {
      await apiClient.checkStatus();
      setBackendConnected(true);

      // Fetch model capabilities to set memory default (only first time)
      try {
        const [caps, models] = await Promise.all([
          apiClient.getCapabilities(),
          apiClient.getModels(),
        ]);
        if (caps?.model_info) {
          setModelInfo((prev) => {
            if (prev === null) {
              // First load only - set memory default based on model size
              setUseMemory(caps.model_info!.is_large_enough_for_memory);
            }
            return caps.model_info!;
          });
        }
        if (models) {
          setModelsData(models);
        }
      } catch (capError) {
        console.warn('Could not fetch model capabilities:', capError);
      }
      try {
        const health = await apiClient.getHealth();
        const startupValidation = health?.components?.startup_validation;
        
        if (startupValidation && !startupValidation.passed) {
          setBackendWarnings(startupValidation.warnings || []);
          console.warn('⚠️ Backend has startup warnings:', startupValidation.warnings);
        } else {
          setBackendWarnings([]);
        }
      } catch (healthError) {
        console.error('Health check failed:', healthError);
      }
    } catch (error) {
      setBackendConnected(false);
      setBackendWarnings([]);
    }
  };

  // Poll backend status every 30 seconds
  useEffect(() => {
    checkBackendStatus(); // Check immediately on load

    const interval = setInterval(checkBackendStatus, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Switch the active LlamaCpp model.
   * Called by ModelBar when the user picks a different model from the dropdown.
   * Also called automatically (once per session) to restore the saved model from
   * UserSettings when the frontend first connects to the backend.
   */
  const handleModelSwitch = useCallback(async (provider: string, model?: string) => {
    if (isSwitching) return;
    setIsSwitching(true);
    setSwitchWarning(null);
    try {
      const result = await apiClient.switchModel(provider, model, userId ?? undefined);
      if (!result.success) {
        setSwitchWarning(result.warning ?? 'Switch failed — check the backend logs.');
        // Still update the displayed model list so the UI shows "no models"
        setModelsData(prev => prev
          ? { ...prev, provider: result.provider, models: result.models }
          : prev);
        return;
      }
      // Backend returned the full updated model list — use it directly
      setModelsData({
        provider: result.provider,
        current_model: result.model ?? '',
        models: result.models,
      });
      // Refresh capabilities (memory recommendation may change with new model)
      const caps = await apiClient.getCapabilities();
      if (caps?.model_info) setModelInfo(caps.model_info);
    } catch (err) {
      setSwitchWarning('Failed to switch — check that the backend is running.');
      console.error('[ModelSwitch] Failed to switch model:', err);
    } finally {
      setIsSwitching(false);
    }
  }, [isSwitching, userId]);

  // Auto-restore the model that was saved in UserSettings.
  // Runs once after modelsData first loads and userId is known.
  useEffect(() => {
    if (modelRestoreAttempted.current) return;
    if (!modelsData || !userId) return;
    if (modelsData.provider !== 'llamacpp') return;

    const savedModel = settings.model; // loaded from UserSettings.default_model
    if (
      savedModel &&
      savedModel !== modelsData.current_model &&
      modelsData.models.includes(savedModel)
    ) {
      console.log(`[ModelRestore] Restoring saved model: ${savedModel} (current: ${modelsData.current_model})`);
      modelRestoreAttempted.current = true;
      handleModelSwitch(modelsData.provider, savedModel);
    } else {
      // Nothing to restore — mark as done so we never retry
      modelRestoreAttempted.current = true;
    }
  }, [modelsData, userId]);  // eslint-disable-line react-hooks/exhaustive-deps

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
              {/* Backend Warnings Banner */}
              {backendWarnings.length > 0 && showWarnings && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">Backend Configuration Issues</h3>
                      </div>
                      <div className="space-y-2">
                        {backendWarnings.map((warning: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <p className="text-yellow-900 dark:text-yellow-200 font-medium">
                              [{warning.component}] {warning.message}
                            </p>
                            <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                              → {warning.suggestion}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowWarnings(false)}
                      className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800/30 rounded transition"
                      title="Dismiss"
                    >
                      <X size={18} className="text-yellow-600 dark:text-yellow-400" />
                    </button>
                  </div>
                </div>
              )}

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
                modelInfo={modelInfo}
              />

              <MessageInput
                onSend={handleSendMessage}
                onStop={handleStopStream}
                isLoading={isLoading}
                isExpanded={isInputExpanded}
              />

              <ModelBar
                modelsData={modelsData}
                onModelSwitch={handleModelSwitch}
                isSwitching={isSwitching}
                switchWarning={switchWarning}
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