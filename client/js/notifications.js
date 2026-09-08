/**
 * notifications.js — Notifications display and interaction module.
 *
 * Responsibilities:
 *   listNotifications()   — Returns notification items (API + fallback)
 *   markAsRead(id)        — Marks single notification as read
 *   markAllAsRead()       — Marks all notifications as read
 *   renderNotifications() — Populates the notifications list with 5 distinct states
 */

import { formatDate, t, applyI18n } from './i18n.js';
import { MOCK_NOTIFICATIONS } from './mock-data.js';
import {
  showLoading,
  showEmpty,
  showToast,
  attachDevStateCycler,
  initOfflineListeners,
} from './ui-states.js';
import { authFetch } from './auth.js';

let notifications = [...MOCK_NOTIFICATIONS];

export async function listNotifications() {
  try {
    const res = await authFetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        notifications = data;
        return notifications;
      }
    }
  } catch (_) {}
  return [...notifications];
}

export function getUnreadCount() {
  return notifications.filter(n => !n.read).length;
}

export async function markAsRead(id) {
  const notif = notifications.find(n => n.id === id);
  if (notif) notif.read = true;

  try {
    await authFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  } catch (_) {}
}

export async function markAllAsRead() {
  notifications.forEach(n => { n.read = true; });

  try {
    await authFetch('/api/notifications/read-all', { method: 'POST' });
  } catch (_) {}
}

// ── Notification Icon & Type Config (5 distinct states) ───────────────────────

function getTypeConfig(type) {
  switch (type) {
    case 'reminder':
      return {
        icon: '🔔',
        borderClass: 'notif-reminder',
        iconClass: 'notif-icon-reminder bg-blue-50 border border-blue-100',
        badgeClass: 'bg-blue-100 text-blue-800',
        badgeIcon: '⏰',
        badgeText: t('notifications.typeReminder'),
      };
    case 'risk':
    case 'warning':
      return {
        icon: '⚠️',
        borderClass: 'notif-risk',
        iconClass: 'notif-icon-risk bg-red-50 border border-red-100',
        badgeClass: 'bg-red-100 text-red-800',
        badgeIcon: '⚠️',
        badgeText: t('notifications.typeWarning'),
      };
    case 'deadline':
      return {
        icon: '⏳',
        borderClass: 'notif-deadline',
        iconClass: 'notif-icon-deadline bg-orange-50 border border-orange-100',
        badgeClass: 'bg-orange-100 text-orange-800',
        badgeIcon: '⏳',
        badgeText: t('notifications.typeDeadline'),
      };
    case 'milestone':
      return {
        icon: '🏆',
        borderClass: 'notif-milestone',
        iconClass: 'notif-icon-milestone bg-purple-50 border border-purple-100',
        badgeClass: 'bg-purple-100 text-purple-800',
        badgeIcon: '🏆',
        badgeText: t('notifications.typeMilestone'),
      };
    case 'completed':
    case 'success':
      return {
        icon: '🎯',
        borderClass: 'notif-completed',
        iconClass: 'notif-icon-completed bg-emerald-50 border border-emerald-100',
        badgeClass: 'bg-emerald-100 text-emerald-800',
        badgeIcon: '✓',
        badgeText: t('notifications.typeCompleted'),
      };
    default:
      return {
        icon: 'ℹ️',
        borderClass: 'border-l-4 border-gray-300',
        iconClass: 'text-gray-600 bg-gray-50 border border-gray-200',
        badgeClass: 'bg-gray-100 text-gray-700',
        badgeIcon: 'ℹ️',
        badgeText: 'Info',
      };
  }
}

// ── Render Notifications ──────────────────────────────────────────────────────

export function renderNotifications() {
  applyI18n();

  const listEl = document.getElementById('notifications-list');
  const countBadgeEl = document.getElementById('unread-count-badge');
  const markAllBtn = document.getElementById('mark-all-read-btn');
  if (!listEl) return;

  const unreadCount = getUnreadCount();
  if (countBadgeEl) {
    if (unreadCount > 0) {
      countBadgeEl.textContent = `${unreadCount} new`;
      countBadgeEl.classList.remove('hidden');
    } else {
      countBadgeEl.classList.add('hidden');
    }
  }

  if (notifications.length === 0) {
    showEmpty(listEl, {
      icon: '📭',
      title: t('notifications.empty'),
      message: t('notifications.emptyHint'),
      ctaText: 'Back to Home',
      ctaHref: 'dashboard.html',
    });
    if (markAllBtn) markAllBtn.disabled = true;
    return;
  }

  if (markAllBtn) {
    markAllBtn.disabled = unreadCount === 0;
  }

  listEl.innerHTML = notifications.map(n => {
    const config = getTypeConfig(n.type);
    const unreadBg = !n.read ? 'bg-white font-medium shadow-sm' : 'bg-gray-50/70 opacity-75';

    return `
      <li
        data-id="${n.id}"
        class="card ${config.borderClass} ${unreadBg} cursor-pointer hover:shadow-md active:scale-[0.99] transition-all duration-150 relative select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        role="button"
        tabindex="0"
        aria-label="${config.badgeText}: ${n.title}. ${n.body}"
      >
        <div class="flex items-start gap-3">
          <div class="text-xl p-2 rounded-xl ${config.iconClass} shrink-0">
            ${config.icon}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.badgeClass}">
                  ${config.badgeIcon} ${config.badgeText}
                </span>
                <span class="text-xs font-bold text-gray-900 truncate">${n.title}</span>
                ${!n.read ? '<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Unread"></span>' : ''}
              </div>
              <span class="text-[10px] text-gray-400 shrink-0">${formatDate(n.date || n.createdAt)}</span>
            </div>
            <p class="text-xs text-gray-600 leading-relaxed">${n.body}</p>
          </div>
        </div>
      </li>
    `;
  }).join('');

  // Wire click and keyboard (Enter/Space) to mark as read
  listEl.querySelectorAll('li[data-id]').forEach(item => {
    const handleRead = () => {
      const id = item.dataset.id;
      markAsRead(id);
      renderNotifications();
    };

    item.addEventListener('click', handleRead);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRead();
      }
    });
  });
}

// ── Initialise Page ───────────────────────────────────────────────────────────

async function init() {
  const listEl = document.getElementById('notifications-list');
  const markAllBtn = document.getElementById('mark-all-read-btn');

  initOfflineListeners();

  if (listEl) showLoading(listEl, 3);

  // Load from API / fallback
  await listNotifications();

  setTimeout(() => {
    renderNotifications();
  }, 150);

  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      await markAllAsRead();
      renderNotifications();
      showToast('All notifications marked as read', 'info');
    });
  }

  const header = document.querySelector('header');
  const main = document.querySelector('main');
  if (header && main) {
    attachDevStateCycler(header, main, renderNotifications);
  }
}

document.addEventListener('DOMContentLoaded', init);

