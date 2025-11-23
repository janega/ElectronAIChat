import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { apiClient } from '../utils/api';
import { Trash2, Loader2, Check, X } from 'lucide-react';

interface SettingsPageProps {
  isDark: boolean;
  onBack: () => void;
  settings: AppSettings;
  onSettingChange: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  onTestBackend?: () => Promise<void>;
  backendConnected?: boolean;
  userId: string | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  saveError: string | null;
  onSaveSettings: () => void;
}

export function SettingsPage({
  isDark,
  onBack,
  settings,
  onSettingChange,
  onTestBackend,
  backendConnected,
  userId,
  saveStatus,
  saveError,
  onSaveSettings,
}: SettingsPageProps) {
  const [testingBackend, setTestingBackend] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleTestBackend = async () => {
    setTestingBackend(true);
    setTestResult(null);

    try {
      const response = await apiClient.checkStatus();
      setTestResult({
        success: true,
        message: JSON.stringify(response, null, 2),
      });
      if (onTestBackend) {
        await onTestBackend();
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTestingBackend(false);
    }
  };

  const handleResetApplication = async () => {
    // First confirmation
    const firstConfirm = window.confirm(
      '⚠️ WARNING: This will permanently delete:\n\n' +
      '• All chats and messages\n' +
      '• All uploaded documents\n' +
      '• All settings and preferences\n' +
      '• Long-term memory (Mem0)\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you sure you want to continue?'
    );

    if (!firstConfirm) return;

    // Second confirmation (extra safety)
    const secondConfirm = window.confirm(
      'FINAL CONFIRMATION:\n\n' +
      'This will delete ALL your data from both your device and the backend.\n\n' +
      'Click OK to proceed, or Cancel to abort.'
    );

    if (!secondConfirm) return;

    setIsResetting(true);

    try {
      // 1. Tell backend to wipe its data
      await apiClient.request('/api/admin/reset', { method: 'POST' });
      
      // 2. Clear all localStorage
      localStorage.clear();
      
      // 3. Show success message before reload
      alert('✅ Application reset complete. The app will now reload.');
      
      // 4. Reload app to force fresh start
      window.location.reload();
      
    } catch (error) {
      console.error('[Settings] Reset failed:', error);
      
      const platform = navigator.platform.toLowerCase();
      const dataPath = platform.includes('win')
        ? '%APPDATA%\\ElectronAIChat'
        : platform.includes('mac')
        ? '~/Library/Application Support/ElectronAIChat'
        : '~/.config/ElectronAIChat';
      
      alert(
        `Failed to reset application:\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        'You may need to manually delete data from:\n' +
        `• ${dataPath}`
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-gray-950">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Chat
        </button>

        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <div className="space-y-8">
          {/* Backend Connection Test */}
          <div className="border-b border-gray-200 dark:border-gray-800 pb-8">
            <h2 className="text-xl font-semibold mb-6">Backend Connection</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full ${
                    backendConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="font-medium">
                  Status: {backendConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <button
                onClick={handleTestBackend}
                disabled={testingBackend}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingBackend ? 'Testing...' : 'Test Backend Connection'}
              </button>

              {testResult && (
                <div
                  className={`p-4 rounded-lg ${
                    testResult.success
                      ? 'bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700'
                      : 'bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700'
                  }`}
                >
                  <p
                    className={`font-semibold mb-2 ${
                      testResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                    }`}
                  >
                    {testResult.success ? 'Success!' : 'Error'}
                  </p>
                  <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                    {testResult.message}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Generation Parameters */}
          <div className="border-b border-gray-200 dark:border-gray-800 pb-8">
            <h2 className="text-xl font-semibold mb-6">Generation Parameters</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Temperature: {settings.temperature.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) =>
                    onSettingChange('temperature', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Higher values = more random, Lower values = more focused (0-2)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={settings.maxTokens}
                  onChange={(e) =>
                    onSettingChange('maxTokens', parseInt(e.target.value))
                  }
                  min="1"
                  max="4096"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum number of tokens to generate
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Top P: {settings.topP.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.topP}
                  onChange={(e) =>
                    onSettingChange('topP', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Nucleus sampling parameter (0-1)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Top K</label>
                <input
                  type="number"
                  value={settings.topK}
                  onChange={(e) =>
                    onSettingChange('topK', parseInt(e.target.value))
                  }
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Top K token filtering parameter
                </p>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div className="border-b border-gray-200 dark:border-gray-800 pb-8">
            <h2 className="text-xl font-semibold mb-6">System Prompt</h2>

            <textarea
              value={settings.systemPrompt}
              onChange={(e) =>
                onSettingChange('systemPrompt', e.target.value)
              }
              placeholder="You are a helpful assistant..."
              rows={8}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Define the behavior and personality of the AI assistant
            </p>
          </div>

          {/* Save Settings Button */}
          <div className="border-b border-gray-200 dark:border-gray-800 pb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={onSaveSettings}
                disabled={saveStatus === 'saving' || !userId || !backendConnected}
                className={`px-6 py-3 rounded-lg transition font-medium ${
                  saveStatus === 'saving' || !userId || !backendConnected
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Settings'
                )}
              </button>

              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 animate-in fade-in duration-200">
                  <Check size={20} />
                  <span className="font-medium">Settings saved!</span>
                </div>
              )}

              {saveStatus === 'error' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <X size={20} />
                    <span className="font-medium">Failed to save: {saveError}</span>
                  </div>
                  <button
                    onClick={onSaveSettings}
                    className="text-sm text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {(!userId || !backendConnected) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ {!userId ? 'User ID not available' : 'Backend must be running to save settings'}
              </p>
            )}
          </div>

          {/* Danger Zone */}
          <div className="border-2 border-red-500 dark:border-red-700 rounded-lg p-6 bg-red-50 dark:bg-red-950/20">
            <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 size={24} />
              Danger Zone
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-red-600 dark:text-red-400 mb-2">
                  Reset Application
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Permanently delete all chats, messages, uploaded documents, and settings. 
                  This will wipe both local cache and backend database.
                </p>
                <button
                  onClick={handleResetApplication}
                  disabled={isResetting || !backendConnected}
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    isResetting || !backendConnected
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isResetting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Reset Application
                    </>
                  )}
                </button>
                
                {!backendConnected && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    ⚠️ Backend must be running to reset application data
                  </p>
                )}
              </div>

              {/* Data Location Info */}
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-4 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
                <p className="font-semibold mb-2">Application Data Locations:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Frontend Cache: Browser localStorage</li>
                  <li>
                    Backend Database: {
                      navigator.platform.toLowerCase().includes('win')
                        ? '%APPDATA%\\ElectronAIChat\\chat_history.db' 
                        : navigator.platform.toLowerCase().includes('mac')
                        ? '~/Library/Application Support/ElectronAIChat/chat_history.db'
                        : '~/.config/ElectronAIChat/chat_history.db'
                    }
                  </li>
                  <li>
                    Document Embeddings: {
                      navigator.platform.toLowerCase().includes('win')
                        ? '%APPDATA%\\ElectronAIChat\\chroma_db\\'
                        : navigator.platform.toLowerCase().includes('mac')
                        ? '~/Library/Application Support/ElectronAIChat/chroma_db/'
                        : '~/.config/ElectronAIChat/chroma_db/'
                    }
                  </li>
                  <li>
                    Memory Store: {
                      navigator.platform.toLowerCase().includes('win')
                        ? '%APPDATA%\\ElectronAIChat\\chroma_db\\mem0\\'
                        : navigator.platform.toLowerCase().includes('mac')
                        ? '~/Library/Application Support/ElectronAIChat/chroma_db/mem0/'
                        : '~/.config/ElectronAIChat/chroma_db/mem0/'
                    }
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}