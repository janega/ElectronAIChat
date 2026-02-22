import React from 'react';
import { Upload, Maximize2, Minimize2, CheckCircle, XCircle, Loader, Brain, AlertTriangle } from 'lucide-react';
import { DocumentWithStatus } from '../types';
import type { ModelInfo } from '../utils/api';

interface ChatControlsProps {
  uploadedDocs: DocumentWithStatus[];
  searchMode: string;
  onSearchModeChange: (mode: string) => void;
  useMemory: boolean;
  onUseMemoryChange: (enabled: boolean) => void;
  onUpload: (files: FileList) => void;
  isLoading: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  modelInfo?: ModelInfo | null;
}

export function ChatControls({
  uploadedDocs,
  searchMode,
  onSearchModeChange,
  useMemory,
  onUseMemoryChange,
  onUpload,
  isLoading,
  isExpanded,
  onToggleExpand,
  modelInfo,
}: ChatControlsProps) {
  const isSmallModel =
    modelInfo != null &&
    modelInfo.estimated_params_billions > 0 &&
    modelInfo.estimated_params_billions <= 1.5;

  const showWarning = isSmallModel && useMemory;
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 flex items-center gap-3">
      <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition"
      title="Upload document(s)">
        <Upload size={18} />        
        {/* <span className="text-sm"></span> */}
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && onUpload(e.target.files)}
          accept=".pdf,.txt,.md,.docx"
          className="hidden"
          disabled={isLoading}          
          aria-label='Upload document(s)'
        />
      </label>

      {uploadedDocs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {uploadedDocs.length} doc(s)
          </span>
          {uploadedDocs.map((doc) => {
            const isProcessing = doc.status && doc.status !== 'ready' && doc.status !== 'error';
            const isError = doc.status === 'error';
            const isReady = doc.status === 'ready';
            
            return (
              <div
                key={doc.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 text-xs rounded"
                title={isError ? doc.error : doc.status}
              >
                <span className="truncate max-w-[120px]">{doc.name}</span>
                {isProcessing && (
                  <>
                    <Loader size={12} className="animate-spin text-blue-600 dark:text-blue-300" />
                    {doc.progress !== undefined && (
                      <span className="text-[10px]">{Math.round(doc.progress)}%</span>
                    )}
                  </>
                )}
                {isReady && <CheckCircle size={12} className="text-green-600 dark:text-green-400" />}
                {isError && <XCircle size={12} className="text-red-600 dark:text-red-400" />}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => onUseMemoryChange(!useMemory)}
        className={`relative p-2 rounded-lg transition flex items-center gap-1.5 group ${
          useMemory
            ? isSmallModel
              ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
              : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
        }`}
        title={
          useMemory
            ? isSmallModel
              ? `Memory ON — ⚠️ ${modelInfo?.name} is a small model. May cause hallucinations.`
              : 'Memory enabled - AI will remember context'
            : 'Memory disabled'
        }
      >
        <Brain size={18} />
        {showWarning && <AlertTriangle size={12} className="text-yellow-600 dark:text-yellow-400" />}
        <span className="text-xs font-medium">{useMemory ? 'ON' : 'OFF'}</span>

        {/* Tooltip warning - only shown when hovering small model + memory on */}
        {showWarning && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-600 text-yellow-800 dark:text-yellow-100 text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-left">
            <p className="font-semibold mb-1">⚠️ Small Model Warning</p>
            <p>
              <strong>{modelInfo?.name}</strong> (~{modelInfo?.estimated_params_billions}B params)
              is below the recommended 1.5B for memory. Fact extraction may cause hallucinations or
              poor responses.
            </p>
          </div>
        )}
      </button>

      <select
        value={searchMode}
        onChange={(e) => onSearchModeChange(e.target.value)}
        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm border border-gray-300 dark:border-gray-700"
      >
        <option value="normal">Search: Normal</option>
        <option value="embeddings">Search: Embeddings Only</option>
        <option value="all">Search: All</option>
      </select>

      <div className="flex-1"></div>

      <button
        onClick={onToggleExpand}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
    </div>
  );
}