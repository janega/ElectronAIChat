import React from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import type { ModelsResponse } from '../utils/api';

interface ModelBarProps {
  modelsData: ModelsResponse | null;
  onModelSwitch?: (model: string) => Promise<void>;
  isSwitching?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  llamacpp: 'LlamaCpp',
  ollama: 'Ollama',
  openai: 'OpenAI',
};

const PROVIDER_COLORS: Record<string, string> = {
  llamacpp: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  ollama:   'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  openai:   'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
};

export function ModelBar({ modelsData, onModelSwitch, isSwitching = false }: ModelBarProps) {
  if (!modelsData) return null;

  const { provider, current_model, models } = modelsData;
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;
  const providerColor = PROVIDER_COLORS[provider] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';

  // Model switching is only supported for llamacpp in Phase 1
  const canSwitch = provider === 'llamacpp' && onModelSwitch != null && models.length > 1;
  const isDisabled = !canSwitch || isSwitching;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    if (newModel === current_model || !onModelSwitch) return;
    await onModelSwitch(newModel);
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 flex items-center gap-3">
      {/* Provider badge */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium shrink-0 ${providerColor}`}>
        <Cpu size={13} />
        {providerLabel}
      </div>

      {/* Model picker */}
      <select
        value={current_model}
        disabled={isDisabled}
        onChange={handleChange}
        title={canSwitch ? 'Switch model' : 'Model switching not available for this provider'}
        className="flex-1 min-w-0 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 truncate disabled:opacity-70 disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:border-blue-400 dark:enabled:hover:border-blue-500 transition-colors"
      >
        {models.length === 0 ? (
          <option value={current_model}>{current_model}</option>
        ) : (
          models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))
        )}
      </select>

      {/* Right-side status indicator */}
      {isSwitching ? (
        <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 shrink-0">
          <Loader2 size={12} className="animate-spin" />
          loading…
        </span>
      ) : canSwitch ? (
        <span className="text-xs text-gray-400 dark:text-gray-600 shrink-0 italic">
          switchable
        </span>
      ) : (
        <span className="text-xs text-gray-400 dark:text-gray-600 shrink-0 italic">
          read-only
        </span>
      )}
    </div>
  );
}
