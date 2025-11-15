import { useState, useEffect, useCallback } from 'react';
import { Chat } from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import { apiClient } from '../utils/api';

export function useChatHistory(username?: string) {
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
    if (!username) {
      console.warn('No username provided for sync');
      return;
    }

    try {
      setIsSyncing(true);
      const backendChats = await apiClient.getUserChats(username);
      
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
  }, [username]);

  // Sync unsynced local chats to backend
  const syncUnsyncedChats = useCallback(async () => {
    if (!username) return;

    const unsyncedChats = chats.filter((chat) => !chat.isSynced && chat.id.startsWith('local-'));
    
    for (const localChat of unsyncedChats) {
      try {
        const backendChat = await apiClient.createChat(username, localChat.title);
        
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
  }, [chats, username]);

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
    if (username) {
      try {
        const backendChat = await apiClient.createChat(username, newChat.title);
        
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
        if (updates.title !== undefined) backendUpdates.title = updates.title;
        if (updates.searchMode !== undefined) backendUpdates.search_mode = updates.searchMode;
        
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

  return {
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
  };
}