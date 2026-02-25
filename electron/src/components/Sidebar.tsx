import React, { useState, useRef, useEffect } from 'react';
import { Chat } from '../types';

// ── Icons ──────────────────────────────────────────────────────────────────
const DocIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const BrainIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5C12 3.34 10.66 2 9 2a3 3 0 0 0-3 3c0 .35.06.69.17 1A3 3 0 0 0 4 9a3 3 0 0 0 1.17 2.37A3 3 0 0 0 6 14a3 3 0 0 0 3 3h1"/>
    <path d="M12 5c0-1.66 1.34-3 3-3a3 3 0 0 1 3 3c0 .35-.06.69-.17 1A3 3 0 0 1 20 9a3 3 0 0 1-1.17 2.37A3 3 0 0 1 18 14a3 3 0 0 1-3 3h-1"/>
    <path d="M9 17v1a3 3 0 0 0 6 0v-1"/>
    <line x1="12" y1="5" x2="12" y2="17"/>
  </svg>
);
const GearIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const ChevL = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevR = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const PencilIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TrashIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const XIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ── Delete Modal ───────────────────────────────────────────────────────────
function DeleteModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#2D2D2D',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '24px 28px',
          width: 320,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontSize: 13, color: '#E8E8E8', fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
          Delete chat?
        </div>
        <div style={{ fontSize: 12, color: '#858585', lineHeight: 1.6, marginBottom: 20, fontFamily: 'var(--font-sans)' }}>
          "<span style={{ color: '#CCCCCC' }}>{title}</span>" will be permanently deleted including all messages and embeddings.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 16px', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, color: '#CCCCCC', fontSize: 11, cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 16px',
              background: 'rgba(244,71,71,0.15)',
              border: '1px solid rgba(244,71,71,0.45)',
              borderRadius: 4, color: '#F44747', fontSize: 11, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
export type RightPanelType = 'docs' | 'memory' | 'settings' | null;

interface SidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  rightPanel: RightPanelType;
  onRightPanelChange: (panel: RightPanelType) => void;
  isCreatingChat?: boolean;
}

// ── Sidebar ────────────────────────────────────────────────────────────────
export function Sidebar({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  rightPanel,
  onRightPanelChange,
  isCreatingChat = false,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingId]);

  const filteredChats = chats.filter((c) =>
    (c.title || 'Untitled').toLowerCase().includes(search.toLowerCase())
  );

  function startRename(chat: Chat) {
    setRenamingId(chat.id);
    setRenameVal(chat.title || 'Untitled');
  }

  function commitRename() {
    if (renamingId && renameVal.trim() && onRenameChat) {
      onRenameChat(renamingId, renameVal.trim());
    }
    setRenamingId(null);
  }

  function confirmDelete() {
    if (deleteTarget) {
      onDeleteChat(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  function getRelativeTime(dateStr: string): string {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '';
    }
  }

  const navItems: { id: RightPanelType; Icon: React.FC<{ size?: number }>; label: string }[] = [
    { id: 'docs', Icon: DocIcon, label: 'Documents' },
    { id: 'memory', Icon: BrainIcon, label: 'Memory' },
    { id: 'settings', Icon: GearIcon, label: 'Settings' },
  ];

  // ── Collapsed rail ──
  if (collapsed) {
    return (
      <div style={{
        width: 48, background: '#252526',
        borderRight: '1px solid #1A1A1A',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '10px 0', gap: 4, flexShrink: 0,
      }}>
        <div
          onClick={() => setCollapsed(false)}
          title="Expand"
          style={{
            width: 26, height: 26, borderRadius: 5,
            background: 'linear-gradient(135deg,#4EC9B0,#569CD6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#1E1E1E', fontWeight: 700,
            fontFamily: 'var(--font-mono)', cursor: 'pointer', marginBottom: 6,
          }}
        >
          AI
        </div>
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#858585' }}
        >
          <ChevR size={14} />
        </button>
        <button
          onClick={onNewChat}
          title="New Chat"
          disabled={isCreatingChat}
          style={{
            width: 28, height: 28, background: 'transparent',
            border: '1px solid rgba(78,201,176,0.35)',
            borderRadius: 4, color: '#4EC9B0', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 4, marginBottom: 8,
          }}
        >
          +
        </button>
        <div style={{ flex: 1 }} />
        {navItems.map(({ id, Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onRightPanelChange(rightPanel === id ? null : id)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
              color: rightPanel === id ? '#4EC9B0' : '#858585',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    );
  }

  // ── Expanded sidebar ──
  return (
    <>
      {deleteTarget && (
        <DeleteModal
          title={deleteTarget.title || 'Untitled'}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <div style={{
        width: 232, background: '#252526',
        borderRight: '1px solid #1A1A1A',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        fontFamily: 'var(--font-mono)',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 12px 10px 14px',
          borderBottom: '1px solid #1A1A1A',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 4,
            background: 'linear-gradient(135deg,#4EC9B0,#569CD6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#1E1E1E', fontWeight: 700, flexShrink: 0,
          }}>
            AI
          </div>
          <span style={{ fontSize: 12, color: '#CCCCCC', fontWeight: 600, letterSpacing: '0.06em', flex: 1 }}>
            ElectronAIChat
          </span>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#555555', padding: 2, borderRadius: 3, display: 'flex', alignItems: 'center',
            }}
          >
            <ChevL size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 10px 4px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#3C3C3C', borderRadius: 4, padding: '5px 9px',
          }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="#858585" strokeWidth="1.5"/>
              <path d="M11 11L15 15" stroke="#858585" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: '#CCCCCC', fontSize: 11, fontFamily: 'var(--font-mono)', width: '100%',
              }}
            />
          </div>
        </div>

        {/* New Chat */}
        <div style={{ padding: '4px 10px 6px' }}>
          <button
            onClick={onNewChat}
            disabled={isCreatingChat}
            style={{
              width: '100%', padding: '6px 10px', background: 'transparent',
              border: '1px solid rgba(78,201,176,0.3)',
              borderRadius: 4, color: '#4EC9B0', fontSize: 11, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'var(--font-mono)', opacity: isCreatingChat ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            {isCreatingChat ? 'Creating…' : 'New Chat'}
          </button>
        </div>

        {/* Section label */}
        <div style={{
          fontSize: 10, color: '#555555', letterSpacing: '0.1em',
          textTransform: 'uppercase', padding: '6px 14px 3px',
        }}>
          Recent
        </div>

        {/* Chat list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.length === 0 ? (
            <p style={{ fontSize: 11, color: '#555555', textAlign: 'center', padding: '16px 0', fontFamily: 'var(--font-mono)' }}>
              No chats yet
            </p>
          ) : (
            filteredChats.map((chat) => {
              const isActive = currentChatId === chat.id;
              const isHov = hoveredId === chat.id;
              const isRen = renamingId === chat.id;
              return (
                <div
                  key={chat.id}
                  onClick={() => !isRen && onSelectChat(chat.id)}
                  onMouseEnter={() => setHoveredId(chat.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '7px 8px 7px 12px', cursor: isRen ? 'default' : 'pointer',
                    background: isActive ? 'rgba(78,201,176,0.07)' : isHov ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderLeft: isActive ? '2px solid #4EC9B0' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isRen ? (
                      <input
                        ref={renameInputRef}
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%', background: '#3C3C3C',
                          border: '1px solid #4EC9B0', borderRadius: 3,
                          padding: '2px 6px', color: '#E8E8E8', fontSize: 11,
                          fontFamily: 'var(--font-mono)', outline: 'none',
                        }}
                      />
                    ) : (
                      <>
                        <div style={{
                          fontSize: 11, color: isActive ? '#E8E8E8' : '#AAAAAA',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {chat.title || 'Untitled'}
                        </div>
                        <div style={{ fontSize: 10, color: '#555555', marginTop: 2 }}>
                          {getRelativeTime(chat.updatedAt || chat.createdAt)}
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', gap: 0, flexShrink: 0,
                    opacity: (isHov || isRen || isActive) ? 1 : 0,
                    transition: 'opacity 0.15s',
                  }}>
                    {isRen ? (
                      <>
                        <button
                          title="Save"
                          onClick={(e) => { e.stopPropagation(); commitRename(); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#4EC9B0', display: 'flex', alignItems: 'center' }}
                        >
                          <CheckIcon />
                        </button>
                        <button
                          title="Cancel"
                          onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#858585', display: 'flex', alignItems: 'center' }}
                        >
                          <XIcon />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          title="Rename"
                          onClick={(e) => { e.stopPropagation(); startRename(chat); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#858585', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#CCCCCC')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#858585')}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(chat); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: '#858585', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#F44747')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#858585')}
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom nav */}
        <div style={{
          borderTop: '1px solid #1A1A1A', padding: '8px 10px',
          display: 'flex', justifyContent: 'space-around',
        }}>
          {navItems.map(({ id, Icon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => onRightPanelChange(rightPanel === id ? null : id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
                color: rightPanel === id ? '#4EC9B0' : '#858585',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { if (rightPanel !== id) (e.currentTarget as HTMLButtonElement).style.color = '#CCCCCC'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = rightPanel === id ? '#4EC9B0' : '#858585'; }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
