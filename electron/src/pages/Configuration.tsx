import React from 'react';
import { ModelConfig } from '../components/ModelConfig';
import { GenerationParams } from '../components/GenerationParams';
import { RagConfig } from '../components/RagConfig';
import { AppSettings } from '../types';

const Configuration: React.FC = () => {
    const [settings, setSettings] = React.useState<AppSettings>({
        server: {
            url: 'http://localhost:11434',
            apiKey: ''
        },
        model: {
            name: 'llama2',
            custom: ''
        },
        generation: {
            temperature: 0.7,
            maxTokens: 2048,
            topK: 40,
            topP: 0.9
        },
        rag: {
            enabled: false,
            chunkSize: 512,
            similarityThreshold: 0.75,
            maxContextChunks: 3
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Save settings
        console.log('Saving settings:', settings);
    };

    const testConnection = async () => {
        try {
            const response = await fetch(`${settings.server.url}/api/status`);
            if (response.ok) {
                alert('Connection successful!');
            } else {
                throw new Error('Connection failed');
            }
        } catch (error) {
            if (error instanceof Error) {
                alert('Connection failed: ' + error.message);
            } else {
                alert('Connection failed: Unknown error');
            }
        }
    };

    return (
        <div className="bg-gray-900 text-gray-100 min-h-screen">
            <header className="bg-gray-800 p-4 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-blue-400 flex items-center">
                        <i data-feather="settings" className="mr-2" /> Ollama Settings
                    </h1>
                    <button
                        onClick={() => window.electron.openChat()}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center transition"
                    >
                        <i data-feather="arrow-left" className="mr-2" /> Back to Chat
                    </button>
                </div>
            </header>

            <main className="container mx-auto p-4">
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold mb-6 text-blue-400">Ollama Configuration</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Server Configuration */}
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="font-semibold mb-4 flex items-center">
                                <i data-feather="server" className="mr-2" /> Server Configuration
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Server URL</label>
                                    <input
                                        type="url"
                                        value={settings.server.url}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            server: { ...settings.server, url: e.target.value }
                                        })}
                                        className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">API Key (optional)</label>
                                    <input
                                        type="password"
                                        value={settings.server.apiKey}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            server: { ...settings.server, apiKey: e.target.value }
                                        })}
                                        className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <ModelConfig settings={settings} setSettings={setSettings} />
                        <GenerationParams settings={settings} setSettings={setSettings} />
                        <RagConfig settings={settings} setSettings={setSettings} />

                        {/* Form Actions */}
                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={testConnection}
                                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition flex items-center"
                            >
                                <i data-feather="wifi" className="mr-2" /> Test Connection
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition flex items-center"
                            >
                                <i data-feather="save" className="mr-2" /> Save Settings
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default Configuration;