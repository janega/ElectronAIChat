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
  chunks?: number;
}

export type DocumentStatus = 'uploading' | 'uploaded' | 'extracting' | 'extracted' | 'chunking' | 'chunking_complete' | 'embedding' | 'ready' | 'error';

export interface DocumentWithStatus extends Document {
  status: DocumentStatus;
  progress?: number; // 0-100
  currentChunk?: number;
  totalChunks?: number;
  error?: string;
}

export interface UploadProgressEvent {
  stage: DocumentStatus;
  progress: number;
  currentChunk?: number;
  totalChunks?: number;
  document?: Document;
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  documents: Document[];
  searchMode: 'normal' | 'embeddings' | 'all';
  createdAt: string;
  updatedAt: string;
  isSynced?: boolean;        // false for local-only chats not yet synced to backend
  serverChatId?: string;     // real ID from backend (when isSynced becomes true)
  draftMessage?: string;     // unsent message text preserved across refreshes
  pendingMessages?: Message[]; // messages queued when backend unreachable
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