/**
 * mock-data.js — Central mock data for all screens.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  MOCK DATA — Replace with real API calls in Phase 2.
 *  All amounts in ₹. All dates in ISO 8601. Timezone: Asia/Kolkata.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Goal categories ───────────────────────────────────────────────────────────

export const GOAL_CATEGORIES = [
  { id: 'education',  icon: '📚', nameKey: 'createGoal.catEducation', defaultTarget: 15000 },
  { id: 'phone',      icon: '📱', nameKey: 'createGoal.catPhone',     defaultTarget: 10000 },
  { id: 'festival',   icon: '🎉', nameKey: 'createGoal.catFestival',  defaultTarget: 5000  },
  { id: 'farming',    icon: '🌾', nameKey: 'createGoal.catFarming',   defaultTarget: 20000 },
  { id: 'home',       icon: '🏠', nameKey: 'createGoal.catHome',      defaultTarget: 50000 },
  { id: 'emergency',  icon: '🏥', nameKey: 'createGoal.catEmergency', defaultTarget: 10000 },
  { id: 'other',      icon: '🎯', nameKey: 'createGoal.catOther',     defaultTarget: 5000  },
];

// ── Family ────────────────────────────────────────────────────────────────────

export const MOCK_FAMILY = {
  familyName: 'Patil',
  memberName: 'Arun',
  language:   'en',
};

// ── Goals ─────────────────────────────────────────────────────────────────────

export const MOCK_GOALS = [
  {
    id:           'goal-1',
    name:         'School Fees — Riya',
    category:     'education',
    icon:         '📚',
    targetAmount: 15000,
    savedAmount:  9750,
    createdAt:    '2026-07-01T00:00:00+05:30',
    deadline:     '2026-11-15T23:59:59+05:30',
    healthStatus: 'ON_TRACK',
  },
  {
    id:           'goal-2',
    name:         'New Phone',
    category:     'phone',
    icon:         '📱',
    targetAmount: 8000,
    savedAmount:  3200,
    createdAt:    '2026-08-01T00:00:00+05:30',
    deadline:     '2026-10-01T23:59:59+05:30',
    healthStatus: 'AT_RISK',
  },
  {
    id:           'goal-3',
    name:         'Diwali Celebration',
    category:     'festival',
    icon:         '🎉',
    targetAmount: 3000,
    savedAmount:  600,
    createdAt:    '2026-08-15T00:00:00+05:30',
    deadline:     '2026-10-20T23:59:59+05:30',
    healthStatus: 'BEHIND',
  },
];

// ── Deposits ──────────────────────────────────────────────────────────────────

export const MOCK_DEPOSITS = [
  { id: 'dep-1',  goalId: 'goal-1', amount: 500,  note: 'Weekly saving',       date: '2026-09-08T09:30:00+05:30' },
  { id: 'dep-2',  goalId: 'goal-2', amount: 200,  note: 'Chai money saved',    date: '2026-09-07T18:15:00+05:30' },
  { id: 'dep-3',  goalId: 'goal-1', amount: 1000, note: 'Sold vegetables',     date: '2026-09-06T11:00:00+05:30' },
  { id: 'dep-4',  goalId: 'goal-3', amount: 100,  note: '',                    date: '2026-09-05T20:00:00+05:30' },
  { id: 'dep-5',  goalId: 'goal-1', amount: 250,  note: 'Found extra change',  date: '2026-09-04T14:30:00+05:30' },
  { id: 'dep-6',  goalId: 'goal-2', amount: 500,  note: 'Monthly bonus',       date: '2026-09-03T10:00:00+05:30' },
  { id: 'dep-7',  goalId: 'goal-3', amount: 200,  note: 'Festival fund',       date: '2026-09-02T16:45:00+05:30' },
  { id: 'dep-8',  goalId: 'goal-1', amount: 500,  note: 'Weekly saving',       date: '2026-09-01T09:30:00+05:30' },
  { id: 'dep-9',  goalId: 'goal-2', amount: 300,  note: 'Saved from market',   date: '2026-08-30T12:00:00+05:30' },
  { id: 'dep-10', goalId: 'goal-3', amount: 300,  note: 'Diwali shopping cut', date: '2026-08-28T18:00:00+05:30' },
];

// ── Notifications ─────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-1', type: 'reminder',  read: false,
    title: 'Time to save!',
    body: 'Save ₹50 today toward New Phone to stay on track.',
    date: '2026-09-08T08:00:00+05:30',
  },
  {
    id: 'notif-2', type: 'warning',   read: false,
    title: 'Goal at risk',
    body: 'Diwali Celebration is falling behind. You need ₹57/day to catch up.',
    date: '2026-09-07T18:00:00+05:30',
  },
  {
    id: 'notif-3', type: 'milestone', read: true,
    title: '50% milestone reached! 🏆',
    body: 'School Fees — Riya is halfway there. Keep going!',
    date: '2026-09-06T12:00:00+05:30',
  },
  {
    id: 'notif-4', type: 'success',   read: true,
    title: 'Great job saving!',
    body: 'You saved ₹500 toward School Fees. Total: ₹9,750.',
    date: '2026-09-05T10:00:00+05:30',
  },
  {
    id: 'notif-5', type: 'reminder',  read: true,
    title: 'Weekly reminder',
    body: 'You\'ve been saving for 5 days straight! Don\'t break the streak.',
    date: '2026-09-04T08:00:00+05:30',
  },
];

// ── Derived / computed helpers ─────────────────────────────────────────────────

/** Get total savings across all goals */
export function getTotalSavings() {
  return MOCK_GOALS.reduce((sum, g) => sum + g.savedAmount, 0);
}

/** Get deposits for a specific goal, sorted newest first */
export function getDepositsForGoal(goalId) {
  return MOCK_DEPOSITS
    .filter(d => d.goalId === goalId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** Get unread notification count */
export function getUnreadCount() {
  return MOCK_NOTIFICATIONS.filter(n => !n.read).length;
}

/** Get the most recent N deposits across all goals */
export function getRecentDeposits(n = 5) {
  return [...MOCK_DEPOSITS]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, n);
}

/** Get today's target (sum of all goal daily requirements) */
export function getTodaysTarget() {
  let total = 0;
  const now = new Date();
  for (const goal of MOCK_GOALS) {
    const deadline = new Date(goal.deadline);
    const remaining = goal.targetAmount - goal.savedAmount;
    if (remaining <= 0) continue;
    const daysLeft = Math.max(1, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
    total += Math.ceil(remaining / daysLeft);
  }
  return total;
}

/** Saving streak (mock — always 5 days for demo) */
export function getSavingStreak() {
  return 5;
}

/** Look up a goal by ID */
export function getGoalById(goalId) {
  return MOCK_GOALS.find(g => g.id === goalId) ?? null;
}

/** Get category info by category ID */
export function getCategoryInfo(categoryId) {
  return GOAL_CATEGORIES.find(c => c.id === categoryId) ?? GOAL_CATEGORIES[6]; // 'other'
}
