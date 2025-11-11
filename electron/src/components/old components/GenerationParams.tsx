import React from 'react';
import { ConfigComponentProps } from '../types';

export const GenerationParams: React.FC<ConfigComponentProps> = ({ settings, setSettings }) => (
    <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold mb-4 flex items-center">
            <i data-feather="sliders" className="mr-2" /> Generation Parameters
        </h3>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1">Temperature (0.1-2.0)</label>
                <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={settings.generation.temperature}
                    onChange={(e) => setSettings({
                        ...settings,
                        generation: { ...settings.generation, temperature: parseFloat(e.target.value) }
                    })}
                    className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Precise</span>
                    <span>{settings.generation.temperature}</span>
                    <span>Creative</span>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Max Tokens</label>
                <input
                    type="number"
                    value={settings.generation.maxTokens}
                    onChange={(e) => setSettings({
                        ...settings,
                        generation: { ...settings.generation, maxTokens: parseInt(e.target.value) }
                    })}
                    min="100"
                    max="4096"
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Top-K Sampling</label>
                <input
                    type="number"
                    value={settings.generation.topK}
                    onChange={(e) => setSettings({
                        ...settings,
                        generation: { ...settings.generation, topK: parseInt(e.target.value) }
                    })}
                    min="1"
                    max="100"
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Top-P Sampling</label>
                <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={settings.generation.topP}
                    onChange={(e) => setSettings({
                        ...settings,
                        generation: { ...settings.generation, topP: parseFloat(e.target.value) }
                    })}
                    className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0.1</span>
                    <span>{settings.generation.topP}</span>
                    <span>1.0</span>
                </div>
            </div>
        </div>
    </div>
);