import { useState, useRef, useCallback } from 'react';
import { Message, AppSettings } from '../types';
import { apiClient } from '../utils/api';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

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

        cleanupRef.current = apiClient.streamResponse(
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
              };
              setMessages((prev) => [...prev, errorMessage]);
            } else {
              // Update existing message with error
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMessageId
                    ? { ...m, content: `Error: ${error.message}` }
                    : m
                )
              );
            }
            setIsLoading(false);
          },
          () => {
            // Stream completed successfully
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Failed to send message:', error);
        
        // Add error message if stream never started
        if (!aiMessageAdded) {
          const errorMessage: Message = {
            id: aiMessageId,
            role: 'assistant',
            content: `Error: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        } else {
          // Update existing message with error
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMessageId
                ? {
                    ...m,
                    content: `Error: ${
                      error instanceof Error ? error.message : 'Unknown error'
                    }`,
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

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    sendMessage,
    cleanup,
  };
}