import { useState, useRef, useCallback } from 'react';
import { Message, AppSettings } from '../types';
import { apiClient } from '../utils/api';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // Track active streams per chat to support concurrent requests
  const activeStreamsRef = useRef<Map<string, () => void>>(new Map());

  const sendMessage = useCallback(
    async (
      content: string,
      chatId: string,
      username: string,
      searchMode: string,
      documentIds: string[],
      settings: AppSettings
    ) => {
      if (!content.trim() || !chatId || !username) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        searchMode: searchMode as any,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const aiMessageId = (Date.now() + 1).toString();
      let aiMessageAdded = false;

      try {
        let fullResponse = '';

        // Updated to match new backend ChatRequest model
        const payload = {
          chatId,
          userId: username,
          message: content,
          searchMode,
          model: settings.model,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          systemPrompt: settings.systemPrompt,
          useMemory: true,
        };

        if (cleanupRef.current) {
          cleanupRef.current();
        }

        const streamCleanup = apiClient.streamResponse(
          '/api/chat/stream',
          payload,
          (chunk) => {
            fullResponse += chunk.token || chunk.content || '';
            
            // Only add the AI message bubble once we have content
            if (!aiMessageAdded && fullResponse.trim()) {
              const aiMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, aiMessage]);
              aiMessageAdded = true;
            } else if (aiMessageAdded) {
              // Update existing message
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMessageId
                    ? { ...m, content: fullResponse }
                    : m
                )
              );
            }
          },
          (error) => {
            console.error('Stream error:', error);
            
            // Add error message if no message was added yet
            if (!aiMessageAdded) {
              const errorMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: new Date().toISOString(),
                error: error.message,
              };
              setMessages((prev) => [...prev, errorMessage]);
            } else {
              // Update existing message with error
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMessageId
                    ? { ...m, content: `Error: ${error.message}`, error: error.message }
                    : m
                )
              );
            }
            setIsLoading(false);
            activeStreamsRef.current.delete(chatId);
          },
          () => {
            // Stream completed successfully
            setIsLoading(false);
            activeStreamsRef.current.delete(chatId);
          }
        );
        
        // Store cleanup function for this chat's stream
        cleanupRef.current = streamCleanup;
        activeStreamsRef.current.set(chatId, streamCleanup);
      } catch (error) {
        console.error('Failed to send message:', error);
        
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        // Add error message if stream never started
        if (!aiMessageAdded) {
          const errorMessage: Message = {
            id: aiMessageId,
            role: 'assistant',
            content: `Error: ${errorMsg}`,
            timestamp: new Date().toISOString(),
            error: errorMsg,
          };
          setMessages((prev) => [...prev, errorMessage]);
        } else {
          // Update existing message with error
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMessageId
                ? {
                    ...m,
                    content: `Error: ${errorMsg}`,
                    error: errorMsg,
                  }
                : m
            )
          );
        }
        setIsLoading(false);
      }
    },
    []
  );

  const cleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
    }
  }, []);

  const stopStream = useCallback((chatId: string) => {
    console.log('[useChat] Stopping stream for chat:', chatId);
    const cleanupFn = activeStreamsRef.current.get(chatId);
    if (cleanupFn) {
      cleanupFn();
      activeStreamsRef.current.delete(chatId);
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    sendMessage,
    stopStream,
    cleanup,
  };
}