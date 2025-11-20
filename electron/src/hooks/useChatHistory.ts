import { useState, useEffect, useCallback } from 'react';
import { Chat, Message } from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import { apiClient } from '../utils/api';

export function useChatHistory(userId?: string) {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT_ID);
    return saved || null;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);

  // Save to localStorage whenever chats change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT_ID, currentChatId);
    }
  }, [currentChatId]);

  // Sync chats from backend
  const syncFromBackend = useCallback(async () => {
    if (!userId) {
      console.warn('No userId provided for sync');
      return;
    }

    try {
      setIsSyncing(true);
      const backendChats = await apiClient.getUserChats(userId);
      
      // Merge backend chats with localStorage
      // Backend is source of truth - use backend data if available
      const localChats = chats;
      const mergedChats: Chat[] = [];
      const backendChatIds = new Set(backendChats.map((c: any) => c.id));

      // Add all backend chats (they're the source of truth)
      for (const backendChat of backendChats) {
        // Try to find matching local chat (by serverChatId or id)
        const localChat = localChats.find((c) => 
          c.serverChatId === backendChat.id || c.id === backendChat.id
        );
        
        // Prefer backend data but keep local messages/documents if available
        mergedChats.push({
          id: backendChat.id,
          title: backendChat.title,
          messages: localChat?.messages || [],
          documents: localChat?.documents || [],
          searchMode: backendChat.search_mode || 'normal',
          createdAt: backendChat.created_at,
          updatedAt: backendChat.updated_at,
          isSynced: true,
          serverChatId: backendChat.id,
        });
      }

      // Add local-only chats (not yet synced to backend)
      for (const localChat of localChats) {
        const isLocalOnly = localChat.id.startsWith('local-') && !localChat.isSynced;
        const notInBackend = localChat.serverChatId && !backendChatIds.has(localChat.serverChatId);
        
        if (isLocalOnly || notInBackend) {
          mergedChats.push(localChat);
        }
      }

      setChats(mergedChats);
      setIsInitialSyncComplete(true);
    } catch (error) {
      console.error('Failed to sync from backend:', error);
      // Continue with localStorage data on error
      setIsInitialSyncComplete(true);
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  // Sync unsynced local chats to backend
  const syncUnsyncedChats = useCallback(async () => {
    if (!userId) return;

    const unsyncedChats = chats.filter((chat) => !chat.isSynced && chat.id.startsWith('local-'));
    
    for (const localChat of unsyncedChats) {
      try {
        const backendChat = await apiClient.createChat(userId, localChat.title);
        
        // Update local chat with server ID
        setChats((prev) =>
          prev.map((c) =>
            c.id === localChat.id
              ? {
                  ...c,
                  serverChatId: backendChat.id,
                  isSynced: true,
                  updatedAt: new Date().toISOString(),
                }
              : c
          )
        );
      } catch (error) {
        console.error(`Failed to sync chat ${localChat.id}:`, error);
        // Continue with next chat
      }
    }
  }, [chats, userId]);

  const createNewChat = async (): Promise<Chat> => {
    // Create temporary local chat immediately for instant UI
    const tempId = `local-${crypto.randomUUID()}`;
    const newChat: Chat = {
      id: tempId,
      title: 'New Chat',
      messages: [],
      documents: [],
      searchMode: 'normal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSynced: false,
    };
    
    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(tempId);

    // Sync to backend in background
    if (userId) {
      try {
        console.log('[createNewChat] Syncing to backend with userId:', userId);
        const backendChat = await apiClient.createChat(userId, newChat.title);
        console.log('[createNewChat] Backend response:', backendChat);
        
        // Update chat with server ID
        setChats((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? {
                  ...c,
                  serverChatId: backendChat.id,
                  isSynced: true,
                  createdAt: backendChat.created_at,
                  updatedAt: backendChat.updated_at,
                }
              : c
          )
        );
      } catch (error) {
        console.error('Failed to sync new chat to backend:', error);
        // Chat remains local-only with isSynced: false
      }
    }

    return newChat;
  };

  const updateChat = async (chatId: string, updates: Partial<Chat>) => {
    console.log('[useChatHistory] Updating chat:', chatId, updates);
    
    // Update locally first for immediate UI feedback
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      )
    );

    // Only sync to backend if chat is already synced
    const chat = chats.find((c) => c.id === chatId);
    if (chat?.isSynced && chat.serverChatId) {
      try {
        const backendUpdates: any = {};
        
        // Only include fields that actually changed
        if (updates.title !== undefined && updates.title !== chat.title) {
          backendUpdates.title = updates.title;
        }
        if (updates.searchMode !== undefined && updates.searchMode !== chat.searchMode) {
          backendUpdates.search_mode = updates.searchMode;
        }
        
        // Only make API call if something actually changed
        if (Object.keys(backendUpdates).length > 0) {
          await apiClient.updateChat(chat.serverChatId, backendUpdates);
        }
      } catch (error) {
        console.error('Failed to sync chat update to backend:', error);
        // Continue with local update
      }
    }
  };

  const deleteChat = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    
    // Delete locally first for immediate UI feedback
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (currentChatId === chatId) {
      const remainingChats = chats.filter((c) => c.id !== chatId);
      setCurrentChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
    }

    // Only delete from backend if chat was synced
    if (chat?.isSynced && chat.serverChatId) {
      try {
        await apiClient.deleteChat(chat.serverChatId);
      } catch (error) {
        console.error('Failed to delete chat from backend:', error);
        // Chat already removed from local state
      }
    }
  };

  const getCurrentChat = (): Chat | undefined => {
    return chats.find((c) => c.id === currentChatId);
  };

  // Calculate unsynced count
  const unsyncedCount = chats.filter((chat) => !chat.isSynced).length;

  const generateTitleIfNeeded = useCallback(async (chatId: string) => {
    // CRITICAL: Check userId at execution time
    if (!userId) {
      console.log('[Title Gen] Skip: No userId available');
      return;
    }

    // Use functional setState to get latest chats without stale closure
    let chat: Chat | undefined;
    setChats((prev) => {
      console.log('[Title Gen] Searching in chats array:', {
        totalChats: prev.length,
        chatIds: prev.map(c => ({ id: c.id, serverChatId: c.serverChatId })),
        searchingFor: chatId
      });
      
      // Search by both local ID and server ID to handle both cases
      chat = prev.find((c) => c.id === chatId || c.serverChatId === chatId);
      
      console.log('[Title Gen] Search result:', {
        found: !!chat,
        foundChatId: chat?.id,
        foundServerChatId: chat?.serverChatId
      });
      
      return prev; // No change, just reading
    });
    
    console.log('[Title Gen] Checking chat:', chatId, {
      exists: !!chat,
      localId: chat?.id,
      isSynced: chat?.isSynced,
      title: chat?.title,
      messageCount: chat?.messages.length,
      serverChatId: chat?.serverChatId
    });
    
    // Only generate if:
    // 1. Chat exists and is synced
    // 2. Still has default title
    // 3. Has at least 2 messages (enough context for title)
    if (!chat?.isSynced || !chat.serverChatId) {
      console.log('[Title Gen] Skip: Not synced or no serverChatId');
      return;
    }
    if (chat.title !== 'New Chat') {
      console.log('[Title Gen] Skip: Title already set:', chat.title);
      return;
    }
    if (chat.messages.length < 2) {
      console.log('[Title Gen] Skip: Not enough messages (need 2+):', chat.messages.length);
      return;
    }
    
    console.log('[Title Gen] ✅ Triggering title generation for chat:', chat.serverChatId);
    
    try {
      const result = await apiClient.generateChatTitle(chat.serverChatId);
      console.log('[Title Gen] Backend response:', result);
      
      if (result.success && result.status === 'generating') {
        // Title is being generated in background
        // Poll for updated title after a short delay
        setTimeout(async () => {
          try {
            console.log('[Title Gen] Polling for updated title...');
            const backendChats = await apiClient.getUserChats(userId!);
            const updatedChat = backendChats.find((c: any) => c.id === chat!.serverChatId);
            
            console.log('[Title Gen] Found updated chat:', updatedChat?.title);
            
            if (updatedChat && updatedChat.title !== 'New Chat') {
              // Update local state with new title - use the LOCAL ID we found earlier
              setChats((prev) => {
                const updated = prev.map((c) =>
                  c.id === chat!.id  // Use LOCAL ID, not the passed chatId
                    ? { ...c, title: updatedChat.title, updatedAt: new Date().toISOString() }
                    : c
                );
                // Force localStorage sync
                localStorage.setItem('chats', JSON.stringify(updated));
                return updated;
              });
              console.log('[Title Gen] ✅ Title updated to:', updatedChat.title);
            } else {
              console.log('[Title Gen] ⚠️ Title still "New Chat" - generation may have failed');
            }
          } catch (error) {
            console.error('[Title Gen] Failed to fetch updated title:', error);
          }
        }, 3000); // Wait 3 seconds for background task to complete
      }
    } catch (error) {
      console.error('[Title Gen] Failed to generate chat title:', error);
      // Fail silently - not critical
    }
  }, [userId]);

  // Update a specific message in a specific chat (for streaming updates)
  const updateChatMessage = useCallback((chatId: string, aiMessage: Message) => {
    console.log('[useChatHistory] Updating message in chat:', chatId, 'message ID:', aiMessage.id);
    
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === chatId) {
          // Check if message exists (update) or is new (add)
          const existingIndex = chat.messages.findIndex((m) => m.id === aiMessage.id);
          
          let updatedMessages: Message[];
          if (existingIndex >= 0) {
            // Update existing message (streaming updates)
            updatedMessages = chat.messages.map((m) =>
              m.id === aiMessage.id ? aiMessage : m
            );
          } else {
            // Add new message
            updatedMessages = [...chat.messages, aiMessage];
          }
          
          return {
            ...chat,
            messages: updatedMessages,
            updatedAt: new Date().toISOString(),
          };
        }
        return chat;
      })
    );
  }, []);

  return {
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
  };
}