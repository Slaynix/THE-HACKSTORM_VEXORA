/**
 * router.js — Simple page navigation utility.
 *
 * No SPA router — real page navigations between HTML files.
 * Wraps window.location so all pages have consistent navigation helpers.
 */

/**
 * Navigate to a page under /pages/.
 * @param {string} page  Filename, e.g. 'dashboard' or 'goal-details'
 * @param {Object} params  Optional query parameters
 */
export function navigateTo(page, params = {}) {
  const query = new URLSearchParams(params).toString();
  const isInPages = window.location.pathname.includes('/pages/');
  const prefix = isInPages ? '' : 'pages/';
  const suffix = query ? `?${query}` : '';
  window.location.href = `${prefix}${page}.html${suffix}`;
}

/**
 * Navigate to root index.html.
 */
export function navigateToLanding() {
  const isInPages = window.location.pathname.includes('/pages/');
  window.location.href = isInPages ? '../index.html' : 'index.html';
}

/**
 * Get a URL query parameter.
 * @param {string} key
 * @returns {string|null}
 */
export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Go back one page in history, or to dashboard as fallback.
 */
export function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigateTo('dashboard');
  }
}
