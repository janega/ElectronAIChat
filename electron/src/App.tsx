import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { DocumentWithStatus, Message } from './types';
import { useTheme, useSettings, useChatHistory, useChat } from './hooks';
import { apiClient } from './utils/api';
import type { ModelInfo, ModelsResponse } from './utils/api';
import { SyncProvider, useSyncContext } from './contexts/SyncContext';
import './styles/globals.css';
import './styles/utils.css'; 
import { 
  ChatWindow, 
  MessageInput,
  Sidebar,
  type RightPanelType,
  SettingsPage,
  DocsPanel,
  MemoryPanel,
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

  const [rightPanel, setRightPanel] = useState<RightPanelType>(null);
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

  const handleRenameChat = async (chatId: string, newTitle: string) => {
    await updateChat(chatId, { title: newTitle });
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

  // ── Chat panel top bar label for search mode ──
  const searchModeLabel: Record<string, string> = {
    normal: 'LLM', embeddings: 'RAG', all: 'ALL',
    manual_search: 'WEB', agentic_search: 'AGENT',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--c-bg)', overflow: 'hidden', transition: 'background-color 0.2s, color 0.2s' }}>
      {/* Left Sidebar */}
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChat}
        onRenameChat={handleRenameChat}
        rightPanel={rightPanel}
        onRightPanelChange={setRightPanel}
        isCreatingChat={isCreatingChat}
      />

      {/* Main Chat Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 42, background: 'var(--c-raised)',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 10, flexShrink: 0,
        }}>
          <span style={{
            fontSize: 13, color: 'var(--c-text-mid)',
            fontFamily: 'var(--font-mono)', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentChat?.title || (currentChatId ? 'Chat' : 'ElectronAIChat')}
          </span>
          {/* Backend warnings dot */}
          {backendWarnings.length > 0 && showWarnings && (
            <span
              title={backendWarnings.map((w: any) => `[${w.component}] ${w.message}`).join('\n')}
              style={{ fontSize: 11, color: 'var(--c-yellow)', fontFamily: 'var(--font-mono)', cursor: 'default' }}
            >
              ⚠ {backendWarnings.length}
            </span>
          )}
          {/* Search mode badge */}
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.07em',
            color: 'var(--c-teal)', background: 'rgba(78,201,176,0.1)',
            border: '1px solid rgba(78,201,176,0.25)', borderRadius: 3, padding: '1px 6px',
          }}>
            {searchModeLabel[searchMode] || 'LLM'}
          </span>
          {/* Model badge */}
          {modelsData?.current_model && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.07em',
              color: 'var(--c-blue)', background: 'rgba(86,156,214,0.1)',
              border: '1px solid rgba(86,156,214,0.25)', borderRadius: 3, padding: '1px 6px',
              maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {modelsData.current_model}
            </span>
          )}
        </div>

        {currentChatId ? (
          <>
            <ChatWindow
              messages={messages}
              isLoading={isLoading}
              messagesEndRef={messagesEndRef}
              isDark={isDark}
              onRetryMessage={handleRetryMessage}
            />

            <MessageInput
              onSend={handleSendMessage}
              onStop={handleStopStream}
              isLoading={isLoading}
              temperature={settings.temperature}
              maxTokens={settings.maxTokens}
              searchMode={searchMode}
              onSearchModeChange={(mode) => {
                setSearchMode(mode);
                if (currentChatId) updateChat(currentChatId, { searchMode: mode as any });
              }}
            />
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, margin: '0 auto 16px',
                background: 'linear-gradient(135deg,#4EC9B0,#569CD6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 21, color: 'var(--c-bg)', fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}>
                AI
              </div>
              <p style={{ fontSize: 19, color: 'var(--c-text-mid)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                Welcome to ElectronAIChat
              </p>
              <p style={{ fontSize: 13, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 24 }}>
                Select a chat or start a new conversation
              </p>
              <button
                onClick={handleNewChat}
                disabled={isCreatingChat}
                style={{
                  padding: '8px 20px', background: 'transparent',
                  border: '1px solid rgba(78,201,176,0.4)',
                  borderRadius: 4, color: 'var(--c-teal)', fontSize: 13,
                  cursor: isCreatingChat ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-mono)', opacity: isCreatingChat ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
                }}
              >
                {isCreatingChat ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creating…
                  </>
                ) : (
                  <><span style={{ fontSize: 17 }}>+</span> New Chat</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panels */}
      {rightPanel === 'docs' && (
        <DocsPanel
          uploadedDocs={uploadedDocs}
          searchMode={searchMode}
          onSearchModeChange={(mode) => {
            setSearchMode(mode);
            if (currentChatId) updateChat(currentChatId, { searchMode: mode as any });
          }}
          onUpload={handleUploadDocument}
          isLoading={isLoading}
        />
      )}
      {rightPanel === 'memory' && (
        <MemoryPanel />
      )}
      {rightPanel === 'settings' && (
        <SettingsPage
          isDark={isDark}
          settings={settings}
          onSettingChange={updateSetting}
          backendConnected={backendConnected}
          userId={userId}
          saveStatus={saveStatus}
          saveError={saveError}
          onSaveSettings={() => userId && saveSettingsToBackend(userId)}
          modelsData={modelsData}
          onModelSwitch={handleModelSwitch}
          useMemory={useMemory}
          onUseMemoryChange={setUseMemory}
          onThemeChange={(dark) => setIsDark(dark)}
        />
      )}

      {/* Username Modal */}
      {showUsernameModal && (
        <UsernameModal
          onUsernameSet={handleUsernameSet}
          isLoading={isSyncing}
        />
      )}

      {/* Loading Overlay during initial sync */}
      {isInitializing && !showUsernameModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            background: 'var(--c-raised)', borderRadius: 8, padding: '32px 40px',
            textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <svg style={{ width: 40, height: 40, color: 'var(--c-teal)', margin: '0 auto 16px' }} className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p style={{ color: 'var(--c-text-mid)', fontSize: 15, fontFamily: 'var(--font-mono)' }}>
              Syncing your chats…
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