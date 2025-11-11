import React from 'react';
import { Upload, Maximize2, Minimize2 } from 'lucide-react';
import { Document } from '../types';

interface ChatControlsProps {
  uploadedDocs: Document[];
  searchMode: string;
  onSearchModeChange: (mode: string) => void;
  onUpload: (files: FileList) => void;
  isLoading: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function ChatControls({
  uploadedDocs,
  searchMode,
  onSearchModeChange,
  onUpload,
  isLoading,
  isExpanded,
  onToggleExpand,
}: ChatControlsProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 flex items-center gap-3">
      <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition">
        <Upload size={18} />
        <span className="text-sm">Upload</span>
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && onUpload(e.target.files)}
          accept=".pdf,.txt,.md,.docx"
          className="hidden"
          disabled={isLoading}
        />
      </label>

      {uploadedDocs.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {uploadedDocs.length} doc(s)
          </span>
          {uploadedDocs.map((doc) => (
            <span
              key={doc.id}
              className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 text-xs rounded"
            >
              {doc.name}
            </span>
          ))}
        </div>
      )}

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