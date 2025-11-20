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
      userId: string,
      searchMode: string,
      documentIds: string[],
      settings: AppSettings,
      skipUserMessage = false, // Skip adding user message for retry scenarios
      onStreamUpdate?: (chatId: string, aiMessage: Message, isDone: boolean) => void // Callback to update specific chat
    ) => {
      if (!content.trim() || !chatId || !userId) return;

      setIsLoading(true);

      const aiMessageId = (Date.now() + 1).toString();
      let aiMessageAdded = false;

      try {
        let fullResponse = '';

        // Updated to match new backend ChatRequest model
        const payload = {
          chatId,
          userId: userId,
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
            
            // Capture sources from final chunk (when done=true)
            if (chunk.done && chunk.sources) {
              // Store sources to attach to final message
              const aiMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString(),
                sources: chunk.sources,
              };
              
              if (aiMessageAdded) {
                // Update existing message with sources
                onStreamUpdate?.(chatId, aiMessage, false);
              }
              return; // Don't process further for done event
            }
            
            // Build AI message as stream progresses
            if (!aiMessageAdded && fullResponse.trim()) {
              const aiMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString(),
              };
              aiMessageAdded = true;
              
              // Notify parent to update the specific chat (streaming in progress)
              onStreamUpdate?.(chatId, aiMessage, false);
            } else if (aiMessageAdded) {
              // Update existing message
              const updatedMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString(),
              };
              
              // Notify parent to update the specific chat (streaming in progress)
              onStreamUpdate?.(chatId, updatedMessage, false);
            }
          },
          (error) => {
            console.error('[useChat] Stream error:', error);
            
            // Build error message
            const errorMessage: Message = {
              id: aiMessageId,
              role: 'assistant',
              content: `Error: ${error.message}`,
              timestamp: new Date().toISOString(),
              error: error.message,
            };
            aiMessageAdded = true;
            
            // Notify parent to update the specific chat (stream done with error)
            onStreamUpdate?.(chatId, errorMessage, true);
            setIsLoading(false);
            activeStreamsRef.current.delete(chatId);
            console.log('[useChat] Cleared stream for chat after error:', chatId);
          },
          () => {
            // Stream completed successfully
            console.log('[useChat] Stream completed for chat:', chatId);
            setIsLoading(false);
            activeStreamsRef.current.delete(chatId);
            
            // Notify parent that stream is complete (no new message, just status)
            if (aiMessageAdded) {
              // Send the final message with isDone=true
              const finalMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: '', // Placeholder, will be ignored
                timestamp: new Date().toISOString(),
              };
              onStreamUpdate?.(chatId, finalMessage, true);
            }
          }
        );
        
        // Store cleanup function for this chat's stream
        cleanupRef.current = streamCleanup;
        activeStreamsRef.current.set(chatId, streamCleanup);
        console.log('[useChat] Started stream for chat:', chatId);
      } catch (error) {
        console.error('Failed to send message:', error);
        
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        // Notify parent about error if stream never started
        if (!aiMessageAdded) {
          const errorMessage: Message = {
            id: aiMessageId,
            role: 'assistant',
            content: `Error: ${errorMsg}`,
            timestamp: new Date().toISOString(),
            error: errorMsg,
          };
          onStreamUpdate?.(chatId, errorMessage, true);
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