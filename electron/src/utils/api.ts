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
    const queryString = new URLSearchParams(
      Object.entries(data).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>)
    ).toString();

    const eventSource = new EventSource(`${url}?${queryString}`);

    eventSource.onmessage = (event) => {
      try {
        const chunk = JSON.parse(event.data) as StreamChunk;
        if (chunk.done) {
          eventSource.close();
          if (onComplete) {
            onComplete();
          }
        } else {
          onChunk(chunk);
        }
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      onError(new Error('Stream connection closed'));
    };

    return () => eventSource.close();
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
}

export const apiClient = new ApiClient();