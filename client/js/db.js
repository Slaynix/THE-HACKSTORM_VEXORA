/**
 * db.js — Client-side IndexedDB storage & pending sync queue.
 *
 * Stores:
 *   1. 'goals'        — Cached goals for instant offline rendering
 *   2. 'deposits'     — Cached deposits (both synced and pending)
 *   3. 'pendingQueue' — Offline actions (ADD_DEPOSIT, CREATE_GOAL) awaiting replay
 */

const DB_NAME = 'sanchay_offline_db';
const DB_VERSION = 1;

let _dbPromise = null;

/**
 * Generate a unique clientTxnId (UUID v4 compliant format).
 * @returns {string}
 */
export function generateClientTxnId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Opens and initializes the IndexedDB instance.
 * @returns {Promise<IDBDatabase>}
 */
export function getDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      console.warn('[DB] IndexedDB not available in this environment');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Goals store
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'id' });
      }

      // 2. Deposits store
      if (!db.objectStoreNames.contains('deposits')) {
        const depStore = db.createObjectStore('deposits', { keyPath: 'id' });
        depStore.createIndex('goalId', 'goalId', { unique: false });
        depStore.createIndex('clientTxnId', 'clientTxnId', { unique: false });
      }

      // 3. Pending Queue store
      if (!db.objectStoreNames.contains('pendingQueue')) {
        const queueStore = db.createObjectStore('pendingQueue', { keyPath: 'clientTxnId' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('[DB] Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
  });

  return _dbPromise;
}

// ── Goals Cache Operations ───────────────────────────────────────────────────

export async function cacheGoals(goalsList = []) {
  const db = await getDB();
  if (!db || !Array.isArray(goalsList)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['goals'], 'readwrite');
    const store = tx.objectStore('goals');
    goalsList.forEach(goal => store.put(goal));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedGoals() {
  const db = await getDB();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['goals'], 'readonly');
    const store = tx.objectStore('goals');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedGoal(id) {
  const db = await getDB();
  if (!db || !id) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['goals'], 'readonly');
    const store = tx.objectStore('goals');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateCachedGoal(id, updates = {}) {
  const goal = await getCachedGoal(id);
  if (!goal) return null;

  const merged = { ...goal, ...updates };
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['goals'], 'readwrite');
    const store = tx.objectStore('goals');
    store.put(merged);
    tx.oncomplete = () => resolve(merged);
    tx.onerror = () => reject(tx.error);
  });
}

// ── Deposits Cache Operations ────────────────────────────────────────────────

export async function cacheDeposits(depositsList = []) {
  const db = await getDB();
  if (!db || !Array.isArray(depositsList)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['deposits'], 'readwrite');
    const store = tx.objectStore('deposits');
    depositsList.forEach(dep => store.put(dep));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveDepositLocally(deposit) {
  const db = await getDB();
  if (!db || !deposit) return deposit;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['deposits'], 'readwrite');
    const store = tx.objectStore('deposits');
    store.put(deposit);
    tx.oncomplete = () => resolve(deposit);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedDeposits(goalId = null) {
  const db = await getDB();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['deposits'], 'readonly');
    const store = tx.objectStore('deposits');

    if (goalId) {
      const index = store.index('goalId');
      const req = index.getAll(goalId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } else {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }
  });
}

// ── Pending Queue Operations ─────────────────────────────────────────────────

export async function enqueuePendingOperation(type, data, clientTxnId = null) {
  const db = await getDB();
  const txnId = clientTxnId || generateClientTxnId();

  const item = {
    clientTxnId: txnId,
    type, // e.g. 'ADD_DEPOSIT' or 'CREATE_GOAL'
    data: { ...data, clientTxnId: txnId },
    status: 'pending',
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  if (!db) return item;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pendingQueue'], 'readwrite');
    const store = tx.objectStore('pendingQueue');
    store.put(item);
    tx.oncomplete = () => {
      console.log(`[DB] Enqueued ${type} with clientTxnId:`, txnId);
      resolve(item);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOperations() {
  const db = await getDB();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pendingQueue'], 'readonly');
    const store = tx.objectStore('pendingQueue');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markOperationSynced(clientTxnId) {
  const db = await getDB();
  if (!db || !clientTxnId) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pendingQueue', 'deposits'], 'readwrite');
    const queueStore = tx.objectStore('pendingQueue');
    const depStore = tx.objectStore('deposits');

    // Remove from queue
    queueStore.delete(clientTxnId);

    // Update deposit status in local store if present
    const depIndex = depStore.index('clientTxnId');
    const depReq = depIndex.get(clientTxnId);
    depReq.onsuccess = () => {
      const dep = depReq.result;
      if (dep) {
        dep.syncStatus = 'synced';
        depStore.put(dep);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markOperationFailed(clientTxnId, errorMsg) {
  const db = await getDB();
  if (!db || !clientTxnId) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pendingQueue'], 'readwrite');
    const store = tx.objectStore('pendingQueue');
    const req = store.get(clientTxnId);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.status = 'failed';
        item.lastError = errorMsg;
        item.retryCount = (item.retryCount || 0) + 1;
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
