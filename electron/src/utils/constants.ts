import { AppSettings } from '../types';

export const API_BASE_URL = 'http://localhost:8000';

export const STORAGE_KEYS = {
  THEME: 'app:theme',
  SETTINGS: 'app:settings',
  CHATS: 'app:chats',
  CURRENT_CHAT_ID: 'app:currentChatId',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'mistral',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  topK: 40,
  systemPrompt: 'You are a helpful assistant.',
  ollamaHost: 'http://localhost:11434',
};