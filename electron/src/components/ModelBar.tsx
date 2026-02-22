import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ModelsResponse } from '../utils/api';

interface ModelBarProps {
  modelsData: ModelsResponse | null;
  onModelSwitch?: (provider: string, model?: string) => Promise<void>;
  isSwitching?: boolean;
  switchWarning?: string | null;
}

const PROVIDER_OPTIONS = [
  { value: 'llamacpp', label: 'LlamaCpp' },
  { value: 'ollama',   label: 'Ollama' },
  { value: 'openai',   label: 'OpenAI' },
];

const PROVIDER_COLORS: Record<string, string> = {
  llamacpp: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  ollama:   'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  openai:   'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
};

export function ModelBar({ modelsData, onModelSwitch, isSwitching = false, switchWarning }: ModelBarProps) {
  if (!modelsData) return null;

  const { provider, current_model, models } = modelsData;
  const providerColor = PROVIDER_COLORS[provider] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700';

  const canSwitch = onModelSwitch != null && !isSwitching;
  const canSwitchModel = canSwitch && models.length > 1;

  const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    if (newProvider === provider || !onModelSwitch) return;
    // No model specified — backend will select the best one for this provider
    await onModelSwitch(newProvider);
  };

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    if (newModel === current_model || !onModelSwitch) return;
    await onModelSwitch(provider, newModel);
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        {/* Provider selector */}
        <select
          value={provider}
          disabled={!canSwitch}
          onChange={handleProviderChange}
          title="Switch LLM provider"
          className={`px-2.5 py-1 rounded-md text-xs font-medium border shrink-0 disabled:opacity-70 disabled:cursor-not-allowed enabled:cursor-pointer transition-colors focus:outline-none ${providerColor}`}
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Model selector */}
        {models.length === 0 ? (
          <span className="flex-1 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 italic">
            No models available
          </span>
        ) : (
          <select
            value={current_model}
            disabled={!canSwitchModel}
            onChange={handleModelChange}
            title={canSwitchModel ? 'Switch model' : 'Model switching not available'}
            className="flex-1 min-w-0 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 truncate disabled:opacity-70 disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:border-blue-400 dark:enabled:hover:border-blue-500 transition-colors"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        {/* Status indicator */}
        {isSwitching ? (
          <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 shrink-0">
            <Loader2 size={12} className="animate-spin" />
            loading…
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-600 shrink-0 italic">
            {canSwitch ? 'switchable' : 'read-only'}
          </span>
        )}
      </div>

      {/* Warning bar (no models / switch failure) */}
      {switchWarning && (
        <p className="text-xs text-amber-600 dark:text-amber-400 leading-snug">
          ⚠️ {switchWarning}
        </p>
      )}
    </div>
  );
}
