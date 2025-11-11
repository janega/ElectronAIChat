export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  searchMode?: 'normal' | 'embeddings' | 'all';
  timestamp: string;
}

export interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  contentType: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  documents: Document[];
  searchMode: 'normal' | 'embeddings' | 'all';
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  systemPrompt: string;
  ollamaHost: string;
}

export interface StreamChunk {
  token?: string;
  content?: string;
  done?: boolean;
}

export type PageType = 'chat' | 'settings';