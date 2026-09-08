/**
 * sync.js — Offline-to-online synchronization engine.
 *
 * Drains the IndexedDB pending queue upon reconnect in chronological order,
 * sending operations with clientTxnId to /api/sync for idempotent upserts.
 */

import { authFetch } from './auth.js';
import {
  getPendingOperations,
  markOperationSynced,
  markOperationFailed,
  cacheGoals,
  getCachedGoals,
} from './db.js';
import { checkReachability, isReachable, initConnectivityMonitor } from './connectivity.js';

let _syncState = 'synced'; // 'synced' | 'syncing' | 'offline'
let _isSyncing = false;

/**
 * Returns current sync state ('synced' | 'syncing' | 'offline').
 * @returns {string}
 */
export function getSyncState() {
  return _syncState;
}

function _setSyncState(state) {
  _syncState = state;
  window.dispatchEvent(new CustomEvent('sync:stateChanged', {
    detail: { state: _syncState },
  }));
}

/**
 * Replays all queued requests against the live /api/sync endpoint.
 * Ensures idempotency: duplicate clientTxnIds return { status: 'EXISTS' }.
 *
 * @returns {Promise<Object>} Sync outcome
 */
export async function syncPendingRequests() {
  if (_isSyncing) return { status: 'IN_PROGRESS' };

  // 1. Verify reachability before attempting sync
  const online = await checkReachability();
  if (!online) {
    _setSyncState('offline');
    return { status: 'OFFLINE' };
  }

  // 2. Fetch all queued pending operations from IndexedDB
  const pending = await getPendingOperations();
  if (pending.length === 0) {
    _setSyncState('synced');
    return { status: 'EMPTY' };
  }

  _isSyncing = true;
  _setSyncState('syncing');
  console.log(`[Sync] Starting sync of ${pending.length} pending operation(s)…`);

  const operationsPayload = pending.map(item => ({
    type: item.type,
    localId: item.clientTxnId,
    data: {
      ...item.data,
      clientTxnId: item.clientTxnId,
    },
  }));

  try {
    const res = await authFetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ operations: operationsPayload }),
    });

    if (!res.ok) {
      throw new Error(`Sync server returned HTTP ${res.status}`);
    }

    const responseData = await res.json();
    const results = responseData.results || [];
    console.log('[Sync] Batch response received:', responseData);

    // 3. Mark each confirmed item as synced in IndexedDB
    for (const r of results) {
      if (r.status === 'APPLIED' || r.status === 'EXISTS') {
        await markOperationSynced(r.localId);
      } else {
        await markOperationFailed(r.localId, r.error || 'Processing skipped');
      }
    }

    // 4. Refresh local goals cache from live server
    try {
      const goalsRes = await authFetch('/api/goals');
      if (goalsRes.ok) {
        const freshGoals = await goalsRes.json();
        await cacheGoals(freshGoals);
      }
    } catch (_) {}

    // Check if any pending remain
    const remaining = await getPendingOperations();
    if (remaining.length === 0) {
      _setSyncState('synced');
    } else {
      _setSyncState('offline');
    }

    // 5. Notify active pages to re-render clean state
    window.dispatchEvent(new CustomEvent('sync:completed', {
      detail: { results, appliedCount: responseData.appliedCount || 0 },
    }));

    _isSyncing = false;
    return responseData;
  } catch (err) {
    console.error('[Sync] Sync request failed:', err.message);
    _isSyncing = false;
    _setSyncState('offline');
    return { status: 'FAILED', error: err.message };
  }
}

// ── Auto-sync on connectivity restored ────────────────────────────────────────
window.addEventListener('connectivity:changed', (e) => {
  if (e.detail.isOnline) {
    syncPendingRequests();
  } else {
    _setSyncState('offline');
  }
});

// Initialize monitor
initConnectivityMonitor();
