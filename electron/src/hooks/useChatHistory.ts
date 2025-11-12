import { useState, useEffect, useCallback } from 'react';
import { Chat } from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import { apiClient } from '../utils/api';

const DEFAULT_USER_ID = 'default-user'; // TODO: Replace with actual user management

export function useChatHistory() {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT_ID);
    return saved || null;
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync with backend on mount
  useEffect(() => {
    syncFromBackend();
  }, []);

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
    try {
      setIsSyncing(true);
      const backendChats = await apiClient.getUserChats(DEFAULT_USER_ID);
      
      // Merge backend chats with localStorage
      // Backend is source of truth - use backend data if available
      const localChats = chats;
      const mergedChats: Chat[] = [];
      const backendChatIds = new Set(backendChats.map((c: any) => c.id));

      // Add all backend chats (they're the source of truth)
      for (const backendChat of backendChats) {
        // Try to find matching local chat
        const localChat = localChats.find((c) => c.id === backendChat.id);
        
        // If local chat exists and is newer, we might want to sync it up
        // For now, prefer backend data
        mergedChats.push({
          id: backendChat.id,
          title: backendChat.title,
          messages: localChat?.messages || [], // Keep local messages for now
          documents: localChat?.documents || [],
          searchMode: backendChat.search_mode || 'normal',
          createdAt: backendChat.created_at,
          updatedAt: backendChat.updated_at,
        });
      }

      // Add local-only chats (not yet synced to backend)
      for (const localChat of localChats) {
        if (!backendChatIds.has(localChat.id)) {
          mergedChats.push(localChat);
          // TODO: Optionally sync to backend here
        }
      }

      setChats(mergedChats);
    } catch (error) {
      console.error('Failed to sync from backend:', error);
      // Continue with localStorage data on error
    } finally {
      setIsSyncing(false);
    }
  }, [chats]);

  const createNewChat = async (): Promise<Chat> => {
    try {
      // Create chat on backend first
      const backendChat = await apiClient.createChat(DEFAULT_USER_ID, 'New Chat');
      
      const newChat: Chat = {
        id: backendChat.id,
        title: backendChat.title,
        messages: [],
        documents: [],
        searchMode: backendChat.search_mode || 'normal',
        createdAt: backendChat.created_at,
        updatedAt: backendChat.updated_at,
      };
      
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      return newChat;
    } catch (error) {
      console.error('Failed to create chat on backend, creating locally:', error);
      
      // Fallback to local creation if backend fails
      const newChat: Chat = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        documents: [],
        searchMode: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      return newChat;
    }
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

    // Sync to backend
    try {
      const backendUpdates: any = {};
      if (updates.title !== undefined) backendUpdates.title = updates.title;
      if (updates.searchMode !== undefined) backendUpdates.search_mode = updates.searchMode;
      
      if (Object.keys(backendUpdates).length > 0) {
        await apiClient.updateChat(chatId, backendUpdates);
      }
    } catch (error) {
      console.error('Failed to sync chat update to backend:', error);
      // Continue with local update
    }
  };

  const deleteChat = async (chatId: string) => {
    // Delete locally first for immediate UI feedback
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(chats.length > 0 ? chats[0].id : null);
    }

    // Delete from backend
    try {
      await apiClient.deleteChat(chatId);
    } catch (error) {
      console.error('Failed to delete chat from backend:', error);
      // Chat already removed from local state
    }
  };

  const getCurrentChat = (): Chat | undefined => {
    return chats.find((c) => c.id === currentChatId);
  };

  return {
    chats,
    currentChatId,
    setCurrentChatId,
    createNewChat,
    updateChat,
    deleteChat,
    getCurrentChat,
    syncFromBackend,
    isSyncing,
  };
}