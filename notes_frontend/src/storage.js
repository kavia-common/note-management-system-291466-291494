//
// Storage module for notes app with IndexedDB primary and localStorage fallback.
// Provides CRUD operations, search/sort, and seeding initial data.
//
// PUBLIC_INTERFACE
export async function initStorage() {
  /**
   * Initialize storage by attempting to open IndexedDB; if unsupported or fails,
   * fall back to localStorage. Also seeds an initial sample note if empty.
   */
  const dbSupported = 'indexedDB' in window;
  let dbHandle = null;

  if (dbSupported) {
    try {
      dbHandle = await openDB('notes_db', 1, (db) => {
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('title', 'title', { unique: false });
        }
      });
      const existing = await getAllIndexed(dbHandle, 'notes');
      if (!existing || existing.length === 0) {
        const sample = seedSample();
        await putIndexed(dbHandle, 'notes', sample);
      }
      return { type: 'indexedDB', db: dbHandle };
    } catch (e) {
      console.warn('IndexedDB init failed, falling back to localStorage', e);
    }
  }

  // Fallback localStorage initialization
  const key = 'notes_db__notes';
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const seed = [seedSample()];
      localStorage.setItem(key, JSON.stringify(seed));
    }
  } catch (e) {
    console.error('localStorage not accessible', e);
  }

  return { type: 'localStorage', key };
}

// PUBLIC_INTERFACE
export async function listNotes(ctx) {
  /** Return array of notes sorted by updatedAt desc */
  if (ctx.type === 'indexedDB') {
    const items = await getAllIndexed(ctx.db, 'notes');
    return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  const items = readLS(ctx.key);
  return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// PUBLIC_INTERFACE
export async function getNote(ctx, id) {
  /** Return a single note by id or null */
  if (!id) return null;
  if (ctx.type === 'indexedDB') {
    return await getIndexed(ctx.db, 'notes', id);
  }
  const items = readLS(ctx.key);
  return items.find(n => n.id === id) || null;
}

// PUBLIC_INTERFACE
export async function createNote(ctx) {
  /** Create a new blank note and return it */
  const note = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Untitled',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (ctx.type === 'indexedDB') {
    await putIndexed(ctx.db, 'notes', note);
    return note;
  }
  const items = readLS(ctx.key);
  items.push(note);
  writeLS(ctx.key, items);
  return note;
}

// PUBLIC_INTERFACE
export async function updateNote(ctx, id, updates) {
  /** Update partial fields on a note; returns updated note */
  if (!id) return null;
  if (ctx.type === 'indexedDB') {
    const existing = await getIndexed(ctx.db, 'notes', id);
    if (!existing) return null;
    const next = { ...existing, ...updates, updatedAt: Date.now() };
    await putIndexed(ctx.db, 'notes', next);
    return next;
  }
  const items = readLS(ctx.key);
  const idx = items.findIndex(n => n.id === id);
  if (idx === -1) return null;
  const next = { ...items[idx], ...updates, updatedAt: Date.now() };
  items[idx] = next;
  writeLS(ctx.key, items);
  return next;
}

// PUBLIC_INTERFACE
export async function deleteNote(ctx, id) {
  /** Delete note by id */
  if (!id) return;
  if (ctx.type === 'indexedDB') {
    await deleteIndexed(ctx.db, 'notes', id);
    return;
  }
  const items = readLS(ctx.key);
  const next = items.filter(n => n.id !== id);
  writeLS(ctx.key, next);
}

// PUBLIC_INTERFACE
export function filterNotes(notes, query) {
  /** Filter by title/content substring, case-insensitive */
  if (!query) return notes;
  const q = query.toLowerCase();
  return notes.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
}

// PUBLIC_INTERFACE
export function sortNotesByUpdated(notes) {
  /** Sort by updatedAt desc */
  return [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Helpers

function seedSample() {
  return {
    id: `note_${Date.now()}`,
    title: 'Welcome to Notes',
    content:
      'This is your first note. Start typing to edit. Use Ctrl/Cmd+N to create a new note, Ctrl/Cmd+S to save, and Delete to remove.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function readLS(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeLS(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed writing to localStorage', e);
  }
}

// IndexedDB thin wrapper
function openDB(name, version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (event) => {
      try {
        const db = req.result;
        onUpgrade && onUpgrade(db, event.oldVersion, event.newVersion);
      } catch (e) {
        reject(e);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

function getAllIndexed(db, store) {
  return new Promise((resolve, reject) => {
    const r = tx(db, store).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

function getIndexed(db, store, key) {
  return new Promise((resolve, reject) => {
    const r = tx(db, store).get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

function putIndexed(db, store, value) {
  return new Promise((resolve, reject) => {
    const r = tx(db, store, 'readwrite').put(value);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function deleteIndexed(db, store, key) {
  return new Promise((resolve, reject) => {
    const r = tx(db, store, 'readwrite').delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
