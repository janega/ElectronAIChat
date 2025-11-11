import React from 'react';
import { ConfigComponentProps } from '../types';

export const RagConfig: React.FC<ConfigComponentProps> = ({ settings, setSettings }) => (
    <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold mb-4 flex items-center">
            <i data-feather="file-text" className="mr-2" /> RAG Configuration
        </h3>
        <div className="space-y-4">
            <div className="flex items-center">
                <input
                    type="checkbox"
                    checked={settings.rag.enabled}
                    onChange={(e) => setSettings({
                        ...settings,
                        rag: { ...settings.rag, enabled: e.target.checked }
                    })}
                    className="rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500 mr-2"
                />
                <label className="text-sm font-medium">Enable Retrieval-Augmented Generation</label>
            </div>
            {settings.rag.enabled && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Chunk Size (tokens)</label>
                        <input
                            type="number"
                            value={settings.rag.chunkSize}
                            onChange={(e) => setSettings({
                                ...settings,
                                rag: { ...settings.rag, chunkSize: parseInt(e.target.value) }
                            })}
                            min="128"
                            max="2048"
                            className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Similarity Threshold</label>
                        <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={settings.rag.similarityThreshold}
                            onChange={(e) => setSettings({
                                ...settings,
                                rag: { ...settings.rag, similarityThreshold: parseFloat(e.target.value) }
                            })}
                            className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>0.1</span>
                            <span>{settings.rag.similarityThreshold}</span>
                            <span>1.0</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Max Context Chunks</label>
                        <input
                            type="number"
                            value={settings.rag.maxContextChunks}
                            onChange={(e) => setSettings({
                                ...settings,
                                rag: { ...settings.rag, maxContextChunks: parseInt(e.target.value) }
                            })}
                            min="1"
                            max="10"
                            className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            )}
        </div>
    </div>
);