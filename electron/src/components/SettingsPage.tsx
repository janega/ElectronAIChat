import React, { useState } from 'react';
import { AppSettings } from '../types';
import { apiClient } from '../utils/api';

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
}

export function SettingsPage({
  isDark,
  onBack,
  settings,
  onSettingChange,
  onTestBackend,
  backendConnected,
}: SettingsPageProps) {
  const [testingBackend, setTestingBackend] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

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

          {/* Model Configuration */}
          <div className="border-b border-gray-200 dark:border-gray-800 pb-8">
            <h2 className="text-xl font-semibold mb-6">Model Configuration</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Model</label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => onSettingChange('model', e.target.value)}
                  placeholder="e.g., mistral, neural-chat"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Model name available on your Ollama instance
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Ollama Host
                </label>
                <input
                  type="text"
                  value={settings.ollamaHost}
                  onChange={(e) => onSettingChange('ollamaHost', e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Backend will use this to connect to Ollama
                </p>
              </div>
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
          <div>
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
        </div>
      </div>
    </div>
  );
}