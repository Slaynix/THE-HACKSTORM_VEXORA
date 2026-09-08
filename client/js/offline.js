/**
 * offline.js — Offline detection and request queuing.
 *
 * When the device is offline, write-operations (POST/PUT) are queued
 * in IndexedDB and replayed by sync.js when connectivity returns.
 *
 * Phase 1: stub.
 * Phase 5: full IndexedDB queue + Background Sync API.
 */

export const isOnline = () => navigator.onLine;

// Pending queue stored in memory for Phase 1; replaced by IndexedDB in Phase 5
const _queue = [];

/**
 * Queues a failed request for later replay.
 * @param {{ method: string, url: string, body: Object }} request
 */
export function enqueue(request) {
  _queue.push({ ...request, queuedAt: new Date().toISOString() });
  console.log('[offline] Enqueued request:', request.url, '| Queue length:', _queue.length);
}

/**
 * Returns all queued requests.
 * @returns {Array}
 */
export function getQueue() {
  return [..._queue];
}

/**
 * Clears the in-memory queue (call after successful sync).
 */
export function clearQueue() {
  _queue.length = 0;
}

// ── Connectivity event listeners ──────────────────────────────────────────────
window.addEventListener('online',  () => console.log('[offline] Back online — sync pending'));
window.addEventListener('offline', () => console.log('[offline] Went offline — queuing mode active'));
