import React, { useState } from 'react';
import { AppSettings } from '../types';
import { apiClient } from '../utils/api';
import type { ModelsResponse } from '../utils/api';

interface SettingsPageProps {
  isDark: boolean;
  onBack?: () => void;
  settings: AppSettings;
  onSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onTestBackend?: () => Promise<void>;
  backendConnected?: boolean;
  userId: string | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  saveError: string | null;
  onSaveSettings: () => void;
  modelsData?: ModelsResponse | null;
  onModelSwitch?: (provider: string, model?: string) => Promise<void>;
  useMemory?: boolean;
  onUseMemoryChange?: (enabled: boolean) => void;
  onThemeChange?: (dark: boolean) => void;
}

const GearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--c-divider)' }}>
      <div style={{
        fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)',
        letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 14px 6px',
      }}>
        {label}
      </div>
      <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      style={{
        width: 34, height: 18, borderRadius: 9, cursor: 'pointer',
        background: enabled ? 'var(--c-teal)' : 'var(--c-input)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: enabled ? 18 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: enabled ? 'var(--c-bg)' : 'var(--c-text-lo)',
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

const PROVIDER_OPTIONS = ['ollama', 'openai', 'llamacpp'] as const;

export function SettingsPage({
  isDark,
  settings,
  onSettingChange,
  backendConnected,
  userId,
  saveStatus,
  saveError,
  onSaveSettings,
  modelsData,
  onModelSwitch,
  useMemory = true,
  onUseMemoryChange,
  onThemeChange,
}: SettingsPageProps) {
  const provider = modelsData?.provider ?? 'ollama';
  const currentModel = modelsData?.current_model ?? settings.model;
  const models = modelsData?.models ?? [];
  const [isResetting, setIsResetting] = useState(false);

  const handleResetApplication = async () => {
    const firstConfirm = window.confirm(
      '⚠️ WARNING: This will permanently delete all chats, documents, settings, and memory.\n\nThis action CANNOT be undone!\n\nAre you sure?'
    );
    if (!firstConfirm) return;
    const secondConfirm = window.confirm('FINAL CONFIRMATION: Click OK to proceed, or Cancel to abort.');
    if (!secondConfirm) return;
    setIsResetting(true);
    try {
      await apiClient.request('/api/admin/reset', { method: 'POST' });
      localStorage.clear();
      alert('✅ Application reset complete. The app will now reload.');
      window.location.reload();
    } catch (error) {
      alert(`Failed to reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div style={{
      width: 260, background: 'var(--c-surface)',
      borderLeft: '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 42, borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--c-text-lo)' }}><GearIcon /></span>
        <span style={{
          fontSize: 12, color: 'var(--c-text-mid)', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}>
          Settings
        </span>
        {/* Backend status dot */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: backendConnected ? 'var(--c-teal)' : 'var(--c-red)',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ fontSize: 10, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>
            {backendConnected ? 'online' : 'offline'}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* LLM Provider */}
        <Section label="LLM Provider">
          <div style={{ display: 'flex', gap: 4 }}>
            {PROVIDER_OPTIONS.map((p) => {
              const isActive = provider === p;
              return (
                <button
                  key={p}
                  onClick={() => onModelSwitch && onModelSwitch(p)}
                  style={{
                    flex: 1, padding: '5px 0', fontFamily: 'var(--font-mono)',
                    fontSize: 11, cursor: 'pointer', borderRadius: 3,
                    background: isActive ? 'rgba(86,156,214,0.12)' : 'transparent',
                    border: isActive ? '1px solid var(--c-blue)' : '1px solid var(--c-input)',
                    color: isActive ? 'var(--c-blue)' : 'var(--c-text-lo)',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
          {provider === 'ollama' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Host</div>
              <input
                defaultValue={settings.ollamaHost || 'http://localhost:11434'}
                style={{
                  width: '100%', background: 'var(--c-input)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 4, padding: '6px 9px', color: 'var(--c-text-mid)',
                  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
                }}
              />
            </div>
          )}
          {/* Model selector */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Model</div>
            {models.length > 1 ? (
              <select
                value={currentModel}
                onChange={(e) => onModelSwitch && onModelSwitch(provider, e.target.value)}
                style={{
                  width: '100%', background: 'var(--c-input)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 4, padding: '6px 9px', color: 'var(--c-text-mid)',
                  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input
                defaultValue={currentModel}
                style={{
                  width: '100%', background: 'var(--c-input)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 4, padding: '6px 9px', color: 'var(--c-text-mid)',
                  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
                }}
              />
            )}
          </div>
        </Section>

        {/* Generation */}
        <Section label="Generation">
          {/* Temperature */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>Temperature</span>
              <span style={{ fontSize: 11, color: 'var(--c-teal)', fontFamily: 'var(--font-mono)' }}>{settings.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0} max={2} step={0.05}
              value={settings.temperature}
              onChange={(e) => onSettingChange('temperature', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-teal)', cursor: 'pointer' }}
            />
          </div>
          {/* Max Tokens */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>Max Tokens</span>
              <span style={{ fontSize: 11, color: 'var(--c-blue)', fontFamily: 'var(--font-mono)' }}>{settings.maxTokens}</span>
            </div>
            <input
              type="range" min={256} max={8192} step={256}
              value={settings.maxTokens}
              onChange={(e) => onSettingChange('maxTokens', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-blue)', cursor: 'pointer' }}
            />
          </div>
          {/* Top P */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>Top P</span>
              <span style={{ fontSize: 11, color: 'var(--c-yellow)', fontFamily: 'var(--font-mono)' }}>{settings.topP.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={settings.topP}
              onChange={(e) => onSettingChange('topP', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-yellow)', cursor: 'pointer' }}
            />
          </div>
        </Section>

        {/* System Prompt */}
        <Section label="System Prompt">
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => onSettingChange('systemPrompt', e.target.value)}
            rows={4}
            placeholder="You are a helpful AI assistant…"
            style={{
              width: '100%', background: 'var(--c-input)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4, padding: '8px 10px', color: 'var(--c-text-mid)',
              fontSize: 12, fontFamily: 'var(--font-sans)',
              resize: 'vertical', lineHeight: 1.6, outline: 'none',
            }}
          />
        </Section>

        {/* Features */}
        <Section label="Features">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-mid)', fontFamily: 'var(--font-sans)' }}>
              Long-term Memory (Mem0)
            </span>
            <ToggleSwitch enabled={useMemory} onChange={(v) => onUseMemoryChange && onUseMemoryChange(v)} />
          </div>
        </Section>

        {/* Appearance */}
        <Section label="Appearance">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['dark', 'light'] as const).map((t) => {
              const isActive = isDark ? t === 'dark' : t === 'light';
              return (
                <button
                  key={t}
                  onClick={() => onThemeChange && onThemeChange(t === 'dark')}
                  style={{
                    flex: 1, padding: '5px 0', fontFamily: 'var(--font-mono)',
                    fontSize: 11, cursor: 'pointer', borderRadius: 3,
                    background: isActive ? 'rgba(78,201,176,0.12)' : 'transparent',
                    border: isActive ? '1px solid var(--c-teal)' : '1px solid var(--c-input)',
                    color: isActive ? 'var(--c-teal)' : 'var(--c-text-lo)',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Danger Zone */}
        <Section label="Danger Zone">
          <button
            onClick={handleResetApplication}
            disabled={isResetting || !backendConnected}
            style={{
              width: '100%', padding: '6px 0',
              background: isResetting || !backendConnected ? 'transparent' : 'rgba(244,71,71,0.08)',
              border: '1px solid rgba(244,71,71,0.35)',
              borderRadius: 4, color: 'var(--c-red)', fontSize: 11,
              cursor: isResetting || !backendConnected ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono)', opacity: isResetting || !backendConnected ? 0.5 : 1,
            }}
          >
            {isResetting ? 'Resetting…' : 'Reset Application'}
          </button>
        </Section>
      </div>

      {/* Save button pinned at bottom */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--c-divider)' }}>
        {saveStatus === 'error' && (
          <p style={{
            fontSize: 11, color: 'var(--c-red)',
            fontFamily: 'var(--font-mono)', marginBottom: 6,
          }}>
            ✗ {saveError || 'Save failed'}
          </p>
        )}
        {saveStatus === 'success' && (
          <p style={{
            fontSize: 11, color: 'var(--c-teal)',
            fontFamily: 'var(--font-mono)', marginBottom: 6,
          }}>
            ✓ Settings saved
          </p>
        )}
        <button
          onClick={onSaveSettings}
          disabled={saveStatus === 'saving' || !userId || !backendConnected}
          style={{
            width: '100%', padding: '8px 0',
            background: saveStatus === 'saving' || !userId || !backendConnected
              ? 'rgba(78,201,176,0.3)' : 'var(--c-teal)',
            border: 'none', borderRadius: 4,
            color: 'var(--c-bg)', fontSize: 12, fontWeight: 600,
            cursor: saveStatus === 'saving' || !userId || !backendConnected ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
          }}
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save Settings'}
        </button>
        {(!userId || !backendConnected) && (
          <p style={{
            fontSize: 10, color: 'var(--c-yellow)',
            fontFamily: 'var(--font-mono)', marginTop: 4, textAlign: 'center',
          }}>
            ⚠️ {!backendConnected ? 'backend offline' : 'no user id'}
          </p>
        )}
      </div>
    </div>
  );
}
