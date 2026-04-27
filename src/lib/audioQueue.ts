/**
 * IndexedDB-backed queue for audio recordings captured while offline.
 * Blobs are stored natively (no base64 inflation) and processed FIFO
 * when the network is restored.
 */

const DB_NAME    = 'euthymia-audio-queue';
const STORE_NAME = 'pending_audio';
const DB_VERSION = 1;

// Safety cap: keep at most 10 pending recordings to avoid filling storage.
const MAX_PENDING = 10;

export interface PendingAudio {
  id: string;
  timestamp: number;
  audioBlob: Blob;
  mimeType: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function enqueueAudio(blob: Blob, mimeType: string): Promise<void> {
  const db = await openDB();

  // Enforce cap: drop the oldest entry if at limit.
  const existing = await getPendingAudio();
  if (existing.length >= MAX_PENDING) {
    await dequeueAudio(existing[0].id);
  }

  const entry: PendingAudio = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    audioBlob: blob,
    mimeType,
  };
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add(entry);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getPendingAudio(): Promise<PendingAudio[]> {
  const db  = await openDB();
  const tx  = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).getAll();
  const items: PendingAudio[] = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as PendingAudio[]);
    req.onerror   = () => reject(req.error);
  });
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function dequeueAudio(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getPendingAudioCount(): Promise<number> {
  const db  = await openDB();
  const tx  = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).count();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
