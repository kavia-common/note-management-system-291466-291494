import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTizenKeys } from './hooks/useTizenKeys';
import './App.css';
import './index.css';
import {
  initStorage,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  filterNotes,
  sortNotesByUpdated,
} from './storage';

// Utility
function formatTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return '';
  }
}

function excerpt(text, max = 80) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

export default function App() {
  const [ctx, setCtx] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState('');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const saveTimer = useRef(null);
  const mountedRef = useRef(false);

  // Initialize storage
  useEffect(() => {
    (async () => {
      const c = await initStorage();
      setCtx(c);
    })();
  }, []);

  // Load notes whenever storage ready
  const refreshNotes = useCallback(async (keepActive = true) => {
    if (!ctx) return;
    const items = await listNotes(ctx);
    setNotes(items);
    if (!keepActive) {
      setActiveId(items[0]?.id || null);
    } else if (items.length > 0) {
      // ensure active still exists
      const stillExists = items.some(n => n.id === activeId);
      if (!stillExists) setActiveId(items[0].id);
    }
  }, [ctx, activeId]);

  useEffect(() => {
    if (!ctx) return;
    refreshNotes(false);
  }, [ctx, refreshNotes]);

  // Derived filtered/sorted list
  const visibleNotes = useMemo(() => {
    const filtered = filterNotes(notes, query);
    return sortNotesByUpdated(filtered);
  }, [notes, query]);

  const activeNote = useMemo(
    () => notes.find(n => n.id === activeId) || null,
    [notes, activeId]
  );

  // Autosave on editor changes (debounced)
  const scheduleSave = useCallback(
    (field, value) => {
      if (!ctx || !activeId) return;
      setSaving(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await updateNote(ctx, activeId, { [field]: value });
        await refreshNotes(true);
        setSaving(false);
      }, 400);
    },
    [ctx, activeId, refreshNotes]
  );

  // Handlers
  const handleCreate = useCallback(async () => {
    if (!ctx) return;
    const n = await createNote(ctx);
    await refreshNotes(true);
    setActiveId(n.id);
    // Slight delay to focus after state update
    setTimeout(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    }, 0);
  }, [ctx, refreshNotes]);

  const handleDelete = useCallback(async () => {
    if (!ctx || !activeId) return;
    const note = notes.find(n => n.id === activeId);
    const ok = confirm(`Delete note "${note?.title || 'Untitled'}"?`);
    if (!ok) return;
    await deleteNote(ctx, activeId);
    await refreshNotes(false);
  }, [ctx, activeId, notes, refreshNotes]);

  const handleSelect = useCallback((id) => setActiveId(id), []);

  const handleTitleChange = useCallback(
    (e) => {
      scheduleSave('title', e.target.value);
    },
    [scheduleSave]
  );

  const handleContentChange = useCallback(
    (e) => {
      scheduleSave('content', e.target.value);
    },
    [scheduleSave]
  );

  // Keyboard shortcuts: Ctrl/Cmd+N, Ctrl/Cmd+S, Delete
  useEffect(() => {
    function onKey(e) {
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreate();
      } else if (isCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (ctx && activeId) {
          // Force flush save immediately based on current values
          const title = titleRef.current?.value ?? activeNote?.title ?? '';
          const content = contentRef.current?.value ?? activeNote?.content ?? '';
          updateNote(ctx, activeId, { title, content }).then(() => {
            refreshNotes(true);
            // brief saving flicker
            setSaving(true);
            setTimeout(() => setSaving(false), 300);
          });
        }
      } else if (!isInputFocused() && e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCreate, handleDelete, ctx, activeId, activeNote, refreshNotes]);

  // Tizen remote support: Map Enter to focusing editor if list item selected
  useTizenKeys({
    onEnter: () => {
      if (!mountedRef.current) return;
      if (document.activeElement?.dataset?.role === 'note-item') {
        setActiveId(document.activeElement.dataset.id);
        setTimeout(() => contentRef.current?.focus(), 0);
      }
    },
    onBack: () => {
      // collapse sidebar on back, else no-op
      setSidebarCollapsed((c) => !c);
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Focus management: when activeNote changes, set textarea value without cursor jump if focused
  useEffect(() => {
    const current = notes.find(n => n.id === activeId) || null;
    if (!current) return;
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.value = current.title || '';
    }
    if (contentRef.current && document.activeElement !== contentRef.current) {
      contentRef.current.value = current.content || '';
    }
  }, [notes, activeId]); // update when selection or list changes

  // UI
  return (
    <div className="notes-app">
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h1 className="app-title">Notes</h1>
          <button className="btn primary" onClick={handleCreate} title="New note (Ctrl/Cmd+N)">
            + New
          </button>
        </div>

        <div className="search-wrap">
          <input
            className="input"
            type="text"
            placeholder="Search notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search notes"
          />
          <button
            className="btn ghost"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
          >
            {isSidebarCollapsed ? '»' : '«'}
          </button>
        </div>

        <ul className="notes-list" role="list">
          {visibleNotes.map((n) => (
            <li key={n.id}>
              <button
                data-role="note-item"
                data-id={n.id}
                className={`note-item ${n.id === activeId ? 'active' : ''}`}
                onClick={() => handleSelect(n.id)}
              >
                <div className="note-title">{n.title || 'Untitled'}</div>
                <div className="note-meta">
                  <span className="note-time">{formatTime(n.updatedAt)}</span>
                  <span className="note-excerpt">{excerpt(n.content)}</span>
                </div>
              </button>
            </li>
          ))}
          {visibleNotes.length === 0 && (
            <li className="empty-state">No notes found</li>
          )}
        </ul>
      </aside>

      <main className="editor-pane">
        {activeNote ? (
          <>
            <div className="editor-toolbar">
              <input
                ref={titleRef}
                className="title-input"
                defaultValue={activeNote.title || ''}
                onChange={handleTitleChange}
                placeholder="Note title"
                aria-label="Note title"
              />
              <div className="toolbar-actions">
                <span className={`save-indicator ${saving ? 'saving' : ''}`}>
                  {saving ? 'Saving…' : 'Saved'}
                </span>
                <button className="btn danger" onClick={handleDelete} title="Delete note (Delete)">
                  Delete
                </button>
              </div>
            </div>
            <textarea
              ref={contentRef}
              className="content-input"
              defaultValue={activeNote.content || ''}
              onChange={handleContentChange}
              placeholder="Start typing your note..."
              aria-label="Note content"
            />
          </>
        ) : (
          <div className="no-selection">
            <p>Select a note or create a new one.</p>
            <button className="btn primary" onClick={handleCreate}>Create your first note</button>
          </div>
        )}
      </main>
    </div>
  );
}

function isInputFocused() {
  const ae = document.activeElement;
  if (!ae) return false;
  return ['INPUT', 'TEXTAREA'].includes(ae.tagName) || ae.getAttribute('contenteditable') === 'true';
}
