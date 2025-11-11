import React from 'react';
import { ConfigComponentProps } from '../types';

export const ModelConfig: React.FC<ConfigComponentProps> = ({ settings, setSettings }) => (
    <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold mb-4 flex items-center">
            <i data-feather="cpu" className="mr-2" /> Model Configuration
        </h3>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <select
                    value={settings.model.name}
                    onChange={(e) => setSettings({
                        ...settings,
                        model: { ...settings.model, name: e.target.value }
                    })}
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="llama2">Llama 2</option>
                    <option value="mistral">Mistral</option>
                    <option value="gemma">Gemma</option>
                    <option value="command-r">Command R</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            {settings.model.name === 'custom' && (
                <div>
                    <label className="block text-sm font-medium mb-1">Custom Model Name</label>
                    <input
                        type="text"
                        value={settings.model.custom}
                        onChange={(e) => setSettings({
                            ...settings,
                            model: { ...settings.model, custom: e.target.value }
                        })}
                        className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="my-custom-model"
                    />
                </div>
            )}
        </div>
    </div>
);