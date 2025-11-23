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
      useMemory: boolean,
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

        // Backend will load settings from database - only send chat-specific data
        const payload = {
          chatId,
          userId: userId,
          message: content,
          searchMode,
          useMemory: useMemory,
        };

        if (cleanupRef.current) {
          cleanupRef.current();
        }

        const streamCleanup = apiClient.streamResponse(
          '/api/chat/stream',
          payload,
          (chunk) => {
            fullResponse += chunk.token || chunk.content || '';
            
            // Log all done chunks for debugging
            if (chunk.done) {
              console.log('[useChat] Final chunk received:', JSON.stringify(chunk));
              console.log('[useChat] Sources in chunk:', chunk.sources);
            }
            
            // Handle final chunk with sources
            if (chunk.done && chunk.sources) {
              console.log('[useChat] Attaching sources to message:', chunk.sources);
              const aiMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString(),
                sources: chunk.sources,
              };
              
              if (aiMessageAdded) {
                // Update existing message with sources AND mark as done
                console.log('[useChat] Updating message with sources (final)');
                onStreamUpdate?.(chatId, aiMessage, true);
              } else {
                // Edge case: sources arrived but no message was added yet
                console.log('[useChat] Creating message with sources (final)');
                onStreamUpdate?.(chatId, aiMessage, true);
                aiMessageAdded = true;
              }
              return; // Don't process further for done event
            }
            
            // Skip processing if stream is done (without sources)
            if (chunk.done) {
              return;
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