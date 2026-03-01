import { Document, StreamChunk } from '../types';
import { API_BASE_URL } from './constants';

export interface MemoryEntry {
  id: string | number;
  memory?: string;
  text?: string;
  ts?: string;
  tag?: string;
  metadata?: Record<string, any>;
}

export interface ModelInfo {
  name: string;
  provider: string;
  estimated_params_billions: number;
  is_large_enough_for_memory: boolean;
  memory_recommendation: 'enabled' | 'disabled';
}

export interface ModelsResponse {
  provider: string;
  current_model: string;
  models: string[];
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  streamResponse(
    endpoint: string,
    data: Record<string, any>,
    onChunk: (chunk: StreamChunk) => void,
    onError: (error: Error) => void,
    onComplete?: () => void
  ): () => void {
    const url = `${this.baseUrl}${endpoint}`;
    let aborted = false;

    // Use fetch with ReadableStream for POST-based SSE
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Stream failed: ${response.status}`);
        }
        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        const readStream = () => {
          reader
            .read()
            .then(({ done, value }) => {
              if (aborted) return;
              
              if (done) {
                if (onComplete) onComplete();
                return;
              }

              // Decode the chunk
              const text = decoder.decode(value, { stream: true });
              
              // Split by SSE data lines
              const lines = text.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const chunk = JSON.parse(line.slice(6)) as StreamChunk;
                    onChunk(chunk);
                  } catch (e) {
                    console.warn('Failed to parse SSE chunk:', line);
                  }
                }
              }

              // Continue reading
              readStream();
            })
            .catch((error) => {
              if (!aborted) {
                onError(error instanceof Error ? error : new Error(String(error)));
              }
            });
        };

        readStream();
      })
      .catch((error) => {
        if (!aborted) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      });

    // Return cleanup function
    return () => {
      aborted = true;
    };
  }

  async uploadDocument(formData: FormData): Promise<{ document: Document }> {
    const url = `${this.baseUrl}/documents/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  async uploadDocumentWithProgress(
    formData: FormData,
    onProgress: (event: any) => void
  ): Promise<Document> {
    const url = `${this.baseUrl}/documents/upload/stream`;
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let finalDocument: Document | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onProgress(data);
              
              if (data.stage === 'ready' && data.document) {
                finalDocument = data.document;
              }
            } catch (e) {
              console.warn('Failed to parse SSE chunk:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!finalDocument) {
      throw new Error('Upload completed but no document returned');
    }

    return finalDocument;
  }

  async checkStatus(): Promise<{ status: string }> {
    const url = `${this.baseUrl}/api/status`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return response.json();
  }

  async getHealth(): Promise<any> {
    const url = `${this.baseUrl}/api/health`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json();
  }

  async getCapabilities(): Promise<{ model_info?: ModelInfo } | null> {
    try {
      const url = `${this.baseUrl}/api/capabilities`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  async getModels(): Promise<ModelsResponse | null> {
    try {
      const url = `${this.baseUrl}/api/models`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  async switchModel(
    provider: string,
    model: string | undefined,
    userId?: string,
  ): Promise<{
    success: boolean;
    provider: string;
    model: string | null;
    models: string[];
    changed: boolean;
    warning: string | null;
  }> {
    return this.request('/api/models/switch', {
      method: 'POST',
      body: JSON.stringify({ provider, model: model ?? null, user_id: userId ?? null }),
    });
  }

  async getUserChats(userId: string): Promise<any[]> {
    const url = `${this.baseUrl}/api/chats/${userId}`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chats: ${response.status}`);
    }

    return response.json();
  }

  async getChatDetail(chatId: string): Promise<any> {
    const url = `${this.baseUrl}/api/chats/detail/${chatId}`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chat detail: ${response.status}`);
    }

    return response.json();
  }

  async createChat(userId: string, title: string = 'New Chat'): Promise<any> {
    const url = `${this.baseUrl}/api/chats/create`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, title }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create chat: ${response.status}`);
    }

    return response.json();
  }

  async updateChat(chatId: string, updates: { title?: string; search_mode?: string }): Promise<any> {
    const url = `${this.baseUrl}/api/chats/${chatId}`;
    const params = new URLSearchParams();
    if (updates.title) params.append('title', updates.title);
    if (updates.search_mode) params.append('search_mode', updates.search_mode);

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error(`Failed to update chat: ${response.status}`);
    }

    return response.json();
  }

  async deleteChat(chatId: string): Promise<any> {
    const url = `${this.baseUrl}/api/chats/${chatId}`;
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete chat: ${response.status}`);
    }

    return response.json();
  }

  async createUser(username: string, email?: string): Promise<any> {
    const url = `${this.baseUrl}/api/users/create`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.status}`);
    }

    return response.json();
  }

  async getUserByUsername(username: string): Promise<any> {
    const url = `${this.baseUrl}/api/users/${username}`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get user: ${response.status}`);
    }

    return response.json();
  }

  async getMemories(userId: string): Promise<{ memories: MemoryEntry[] }> {
    return this.request(`/api/memories/${encodeURIComponent(userId)}`);
  }

  async updateMemory(memoryId: string, memory: string): Promise<{ success: boolean; memory_id: string }> {
    return this.request(`/api/memories/${encodeURIComponent(memoryId)}`, {
      method: 'PUT',
      body: JSON.stringify({ memory }),
    });
  }

  async deleteMemory(memoryId: string): Promise<{ success: boolean; memory_id: string }> {
    return this.request(`/api/memories/${encodeURIComponent(memoryId)}`, {
      method: 'DELETE',
    });
  }

  async clearAllMemories(userId: string): Promise<{ success: boolean; deleted: number }> {
    return this.request(`/api/memories/${encodeURIComponent(userId)}/all`, {
      method: 'DELETE',
    });
  }

  async generateChatTitle(chatId: string): Promise<{ success: boolean; title?: string; status?: string }> {    const url = `${this.baseUrl}/api/chats/${chatId}/generate-title`;
    try {
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        console.warn('Title generation failed:', response.status);
        return { success: false };
      }

      return response.json();
    } catch (error) {
      console.error('Title generation request failed:', error);
      return { success: false };
    }
  }

  async getUserSettings(userId: string): Promise<UserSettingsResponse> {
    const url = `${this.baseUrl}/api/users/${userId}/settings`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get user settings: ${response.status}`);
    }

    return response.json();
  }

  async updateUserSettings(userId: string, settings: SettingsPayload): Promise<UserSettingsResponse> {
    const url = `${this.baseUrl}/api/users/${userId}/settings`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error(`Failed to update user settings: ${response.status}`);
    }

    return response.json();
  }
}

// Type definitions for settings API
export interface UserSettingsResponse {
  id: string;
  user_id: string;
  default_model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  top_k: number;
  system_prompt: string;
  theme: string;
  use_memory: boolean;
  use_mcp: boolean;
  updated_at: string;
}

export interface SettingsPayload {
  default_model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  system_prompt?: string;
  theme?: string;
  use_memory?: boolean;
  use_mcp?: boolean;
}

// Helper functions for field mapping (camelCase <-> snake_case)
export function toBackendSettings(frontend: import('../types').AppSettings): SettingsPayload {
  return {
    default_model: frontend.model,
    temperature: frontend.temperature,
    max_tokens: frontend.maxTokens,
    top_p: frontend.topP,
    top_k: frontend.topK,
    system_prompt: frontend.systemPrompt,
    // ollamaHost is not sent (should be global config, not per-user)
  };
}

export function toFrontendSettings(backend: UserSettingsResponse): import('../types').AppSettings {
  return {
    model: backend.default_model,
    temperature: backend.temperature,
    maxTokens: backend.max_tokens,
    topP: backend.top_p,
    topK: backend.top_k,
    systemPrompt: backend.system_prompt,
    ollamaHost: 'http://localhost:11434', // Keep default, not synced from backend
  };
}

export const apiClient = new ApiClient();