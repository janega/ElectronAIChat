import { Document, StreamChunk } from '../types';
import { API_BASE_URL } from './constants';

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
                    if (chunk.done) {
                      if (onComplete) onComplete();
                      return;
                    }
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

  async checkStatus(): Promise<{ status: string }> {
    const url = `${this.baseUrl}api/status`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return response.json();
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
}

export const apiClient = new ApiClient();