import { supabase } from '@/integrations/supabase/client';

export interface QueuedMutation {
  id: string;
  timestamp: number;
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  payload: any;
  match?: Record<string, string>;
}

const DB_NAME = 'euthymia-offline';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;

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
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const entry: QueuedMutation = {
    ...mutation,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  store.add(entry);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.count();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  const items: QueuedMutation[] = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Sort by timestamp
  items.sort((a, b) => a.timestamp - b.timestamp);

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      let result;
      switch (item.operation) {
        case 'insert':
          result = await supabase.from(item.table as any).insert(item.payload);
          break;
        case 'update':
          if (!item.match) throw new Error('Update requires match');
          result = await supabase.from(item.table as any).update(item.payload);
          for (const [col, val] of Object.entries(item.match)) {
            result = (result as any).eq(col, val);
          }
          break;
        case 'upsert':
          result = await supabase.from(item.table as any).upsert(item.payload);
          break;
        case 'delete':
          if (!item.match) throw new Error('Delete requires match');
          result = supabase.from(item.table as any).delete();
          for (const [col, val] of Object.entries(item.match)) {
            result = (result as any).eq(col, val);
          }
          break;
      }

      if ((result as any)?.error) throw (result as any).error;

      // Remove from queue
      const delTx = db.transaction(STORE_NAME, 'readwrite');
      delTx.objectStore(STORE_NAME).delete(item.id);
      await new Promise<void>((res, rej) => {
        delTx.oncomplete = () => res();
        delTx.onerror = () => rej(delTx.error);
      });
      synced++;
    } catch (err) {
      console.error('[OfflineQueue] Failed to sync mutation:', item, err);
      failed++;
    }
  }

  return { synced, failed };
}
