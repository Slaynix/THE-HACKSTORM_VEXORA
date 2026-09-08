/**
 * connectivity.js — Active network reachability detector.
 *
 * Combines navigator.onLine with an active lightweight HTTP ping to /health
 * to accurately detect real server connectivity (preventing false positives
 * on captive portals, dead routers, or airplane mode toggles).
 */

const PING_URL = 'http://localhost:3000/health';
const PING_TIMEOUT_MS = 2500;

let _isReachable = navigator.onLine;
let _probeTimer = null;

/**
 * Perform an active reachability check against the server /health endpoint.
 * @returns {Promise<boolean>}
 */
export async function checkReachability() {
  if (!navigator.onLine) {
    _updateStatus(false);
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  try {
    const res = await fetch(PING_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const reachable = res.ok;
    _updateStatus(reachable);
    return reachable;
  } catch (_) {
    clearTimeout(timeoutId);
    _updateStatus(false);
    return false;
  }
}

/**
 * Returns current cached reachability state.
 * @returns {boolean}
 */
export function isReachable() {
  return _isReachable;
}

function _updateStatus(newStatus) {
  const changed = _isReachable !== newStatus;
  _isReachable = newStatus;

  if (changed) {
    console.log(`[Connectivity] Status changed -> ${_isReachable ? 'ONLINE (Reachable)' : 'OFFLINE (Unreachable)'}`);
    window.dispatchEvent(new CustomEvent('connectivity:changed', {
      detail: { isOnline: _isReachable },
    }));
  }
}

/**
 * Start periodic reachability checks and listen to browser events.
 */
export function initConnectivityMonitor() {
  // Check immediately
  checkReachability();

  // Browser offline event
  window.addEventListener('offline', () => {
    _updateStatus(false);
  });

  // Browser online event -> verify with real ping immediately
  window.addEventListener('online', () => {
    checkReachability();
  });

  // Background health poll every 10s
  if (!_probeTimer) {
    _probeTimer = setInterval(checkReachability, 10000);
  }
}
