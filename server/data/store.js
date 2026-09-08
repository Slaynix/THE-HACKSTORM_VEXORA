'use strict';

/**
 * store.js — In-Memory Data Store (Temporary for Phase 2).
 *
 * Structured to mirror Cloud Firestore collections:
 *   - families/{familyId}
 *   - users/{uid}
 *   - members/{memberId}
 *   - goals/{goalId}
 *   - deposits/{depositId}
 *   - notifications/{notificationId}
 *
 * In Phase 3, this file can be swapped for direct Firestore operations
 * without modifying controllers or services.
 */

const INITIAL_DATA = {
  families: [
    {
      id: 'fam-patil-1',
      name: 'Patil',
      preferredLanguage: 'en',
      createdAt: '2026-07-01T00:00:00+05:30',
      updatedAt: '2026-09-08T00:00:00+05:30',
    },
  ],
  users: [
    {
      id: 'user-patil-1',
      email: 'arun.patil@example.com',
      phoneNumber: '+919876543210',
      familyId: 'fam-patil-1',
      memberName: 'Arun',
      role: 'admin',
      createdAt: '2026-07-01T00:00:00+05:30',
    },
  ],
  members: [
    {
      id: 'mem-1',
      familyId: 'fam-patil-1',
      name: 'Arun',
      role: 'Head of Family',
      phone: '+919876543210',
      createdAt: '2026-07-01T00:00:00+05:30',
    },
    {
      id: 'mem-2',
      familyId: 'fam-patil-1',
      name: 'Sunita',
      role: 'Mother',
      phone: '+919876543211',
      createdAt: '2026-07-01T00:00:00+05:30',
    },
    {
      id: 'mem-3',
      familyId: 'fam-patil-1',
      name: 'Riya',
      role: 'Daughter',
      phone: '',
      createdAt: '2026-07-05T00:00:00+05:30',
    },
  ],
  goals: [
    {
      id: 'goal-1',
      familyId: 'fam-patil-1',
      createdBy: 'user-patil-1',
      name: 'School Fees',
      category: 'education',
      icon: '📚',
      targetAmount: 20000,
      savedAmount: 12500,
      createdAt: '2026-07-01T00:00:00+05:30',
      deadline: '2026-10-25T23:59:59+05:30',
      status: 'ON_TRACK',
      updatedAt: '2026-09-08T09:30:00+05:30',
    },
    {
      id: 'goal-2',
      familyId: 'fam-patil-1',
      createdBy: 'user-patil-1',
      name: 'New Phone',
      category: 'phone',
      icon: '📱',
      targetAmount: 15000,
      savedAmount: 6000,
      createdAt: '2026-08-01T00:00:00+05:30',
      deadline: '2026-10-03T23:59:59+05:30',
      status: 'AT_RISK',
      updatedAt: '2026-09-07T18:15:00+05:30',
    },
    {
      id: 'goal-3',
      familyId: 'fam-patil-1',
      createdBy: 'user-patil-1',
      name: 'Diwali Expenses',
      category: 'festival',
      icon: '🎉',
      targetAmount: 5000,
      savedAmount: 1200,
      createdAt: '2026-08-15T00:00:00+05:30',
      deadline: '2026-09-26T23:59:59+05:30',
      status: 'BEHIND',
      updatedAt: '2026-09-05T20:00:00+05:30',
    },
    {
      id: 'goal-4',
      familyId: 'fam-patil-1',
      createdBy: 'user-patil-1',
      name: 'Farming Equipment',
      category: 'farming',
      icon: '🌾',
      targetAmount: 30000,
      savedAmount: 18000,
      createdAt: '2026-07-25T00:00:00+05:30',
      deadline: '2026-11-07T23:59:59+05:30',
      status: 'ON_TRACK',
      updatedAt: '2026-09-08T00:00:00+05:30',
    },
  ],
  deposits: [
    // School Fees (12,500)
    { id: 'dep-1', goalId: 'goal-1', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 3000, notes: 'Crop sale initial share', depositDate: '2026-07-20T10:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-1', createdAt: '2026-07-20T10:00:00+05:30', updatedAt: '2026-07-20T10:00:00+05:30' },
    { id: 'dep-2', goalId: 'goal-1', familyId: 'fam-patil-1', memberId: 'mem-2', memberName: 'Sunita', amount: 2500, notes: 'Vegetable market surplus', depositDate: '2026-08-01T11:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-2', createdAt: '2026-08-01T11:00:00+05:30', updatedAt: '2026-08-01T11:00:00+05:30' },
    { id: 'dep-3', goalId: 'goal-1', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 2000, notes: 'Monthly school fund saving', depositDate: '2026-08-15T09:30:00+05:30', source: 'manual', clientTxnId: 'txn-dep-3', createdAt: '2026-08-15T09:30:00+05:30', updatedAt: '2026-08-15T09:30:00+05:30' },
    { id: 'dep-4', goalId: 'goal-1', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 2000, notes: 'Weekly harvest saving', depositDate: '2026-08-25T14:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-4', createdAt: '2026-08-25T14:00:00+05:30', updatedAt: '2026-08-25T14:00:00+05:30' },
    { id: 'dep-5', goalId: 'goal-1', familyId: 'fam-patil-1', memberId: 'mem-2', memberName: 'Sunita', amount: 1500, notes: 'Saved from grocery budget', depositDate: '2026-09-01T16:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-5', createdAt: '2026-09-01T16:00:00+05:30', updatedAt: '2026-09-01T16:00:00+05:30' },
    { id: 'dep-6', goalId: 'goal-1', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 1500, notes: 'Dairy payment deposit', depositDate: '2026-09-07T12:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-6', createdAt: '2026-09-07T12:00:00+05:30', updatedAt: '2026-09-07T12:00:00+05:30' },

    // New Phone (6,000)
    { id: 'dep-7',  goalId: 'goal-2', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 2000, notes: 'Initial phone fund deposit', depositDate: '2026-08-10T10:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-7', createdAt: '2026-08-10T10:00:00+05:30', updatedAt: '2026-08-10T10:00:00+05:30' },
    { id: 'dep-8',  goalId: 'goal-2', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 1500, notes: 'Overtime bonus saved', depositDate: '2026-08-21T18:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-8', createdAt: '2026-08-21T18:00:00+05:30', updatedAt: '2026-08-21T18:00:00+05:30' },
    { id: 'dep-9',  goalId: 'goal-2', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 1000, notes: 'Weekly micro-saving', depositDate: '2026-08-29T11:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-9', createdAt: '2026-08-29T11:00:00+05:30', updatedAt: '2026-08-29T11:00:00+05:30' },
    { id: 'dep-10', goalId: 'goal-2', familyId: 'fam-patil-1', memberId: 'mem-2', memberName: 'Sunita', amount: 1000, notes: 'Festival advance savings', depositDate: '2026-09-03T15:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-10', createdAt: '2026-09-03T15:00:00+05:30', updatedAt: '2026-09-03T15:00:00+05:30' },
    { id: 'dep-11', goalId: 'goal-2', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 500,  notes: 'Chai money cut', depositDate: '2026-09-06T17:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-11', createdAt: '2026-09-06T17:00:00+05:30', updatedAt: '2026-09-06T17:00:00+05:30' },

    // Diwali Expenses (1,200)
    { id: 'dep-12', goalId: 'goal-3', familyId: 'fam-patil-1', memberId: 'mem-2', memberName: 'Sunita', amount: 500, notes: 'Diwali sweet fund starter', depositDate: '2026-08-16T12:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-12', createdAt: '2026-08-16T12:00:00+05:30', updatedAt: '2026-08-16T12:00:00+05:30' },
    { id: 'dep-13', goalId: 'goal-3', familyId: 'fam-patil-1', memberId: 'mem-2', memberName: 'Sunita', amount: 400, notes: 'Tailoring income saved', depositDate: '2026-08-28T14:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-13', createdAt: '2026-08-28T14:00:00+05:30', updatedAt: '2026-08-28T14:00:00+05:30' },
    { id: 'dep-14', goalId: 'goal-3', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 300, notes: 'Market discount savings', depositDate: '2026-09-05T19:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-14', createdAt: '2026-09-05T19:00:00+05:30', updatedAt: '2026-09-05T19:00:00+05:30' },

    // Farming Equipment (18,000)
    { id: 'dep-15', goalId: 'goal-4', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 5000, notes: 'Paddy harvest income', depositDate: '2026-07-28T10:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-15', createdAt: '2026-07-28T10:00:00+05:30', updatedAt: '2026-07-28T10:00:00+05:30' },
    { id: 'dep-16', goalId: 'goal-4', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 4000, notes: 'Cotton seed advance sale', depositDate: '2026-08-10T11:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-16', createdAt: '2026-08-10T11:00:00+05:30', updatedAt: '2026-08-10T11:00:00+05:30' },
    { id: 'dep-17', goalId: 'goal-4', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 3500, notes: 'Tractor rental earning saved', depositDate: '2026-08-20T15:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-17', createdAt: '2026-08-20T15:00:00+05:30', updatedAt: '2026-08-20T15:00:00+05:30' },
    { id: 'dep-18', goalId: 'goal-4', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 3000, notes: 'Wheat produce profit', depositDate: '2026-08-30T16:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-18', createdAt: '2026-08-30T16:00:00+05:30', updatedAt: '2026-08-30T16:00:00+05:30' },
    { id: 'dep-19', goalId: 'goal-4', familyId: 'fam-patil-1', memberId: 'mem-1', memberName: 'Arun', amount: 2500, notes: 'Weekly agricultural deposit', depositDate: '2026-09-08T08:00:00+05:30', source: 'manual', clientTxnId: 'txn-dep-19', createdAt: '2026-09-08T08:00:00+05:30', updatedAt: '2026-09-08T08:00:00+05:30' },
  ],
  notifications: [
    {
      id: 'notif-1',
      familyId: 'fam-patil-1',
      type: 'reminder',
      read: false,
      title: 'Time to save!',
      body: 'Save ₹50 today toward New Phone to stay on track.',
      date: '2026-09-08T08:00:00+05:30',
      createdAt: '2026-09-08T08:00:00+05:30',
    },
    {
      id: 'notif-2',
      familyId: 'fam-patil-1',
      type: 'warning',
      read: false,
      title: 'Goal at risk',
      body: 'Diwali Expenses is falling behind. You need ₹57/day to catch up.',
      date: '2026-09-07T18:00:00+05:30',
      createdAt: '2026-09-07T18:00:00+05:30',
    },
    {
      id: 'notif-3',
      familyId: 'fam-patil-1',
      type: 'milestone',
      read: true,
      title: '50% milestone reached! 🏆',
      body: 'School Fees is 62.5% completed. Great consistency!',
      date: '2026-09-06T12:00:00+05:30',
      createdAt: '2026-09-06T12:00:00+05:30',
    },
    {
      id: 'notif-4',
      familyId: 'fam-patil-1',
      type: 'success',
      read: true,
      title: 'Great job saving!',
      body: 'You saved ₹2,500 toward Farming Equipment. Total: ₹18,000.',
      date: '2026-09-08T08:00:00+05:30',
      createdAt: '2026-09-08T08:00:00+05:30',
    },
  ],
};

// Clone deep helper
function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

let db = clone(INITIAL_DATA);

const store = {
  reset() {
    db = clone(INITIAL_DATA);
  },

  get(collection) {
    if (!db[collection]) db[collection] = [];
    return db[collection];
  },

  findById(collection, id) {
    const list = this.get(collection);
    const item = list.find((doc) => doc.id === id);
    return item ? clone(item) : null;
  },

  find(collection, filterFn) {
    const list = this.get(collection);
    const results = filterFn ? list.filter(filterFn) : list;
    return clone(results);
  },

  create(collection, doc) {
    const list = this.get(collection);
    const now = new Date().toISOString();
    const newDoc = {
      id: doc.id || `${collection.slice(0, 4)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...doc,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };
    list.unshift(newDoc);
    return clone(newDoc);
  },

  update(collection, id, updates) {
    const list = this.get(collection);
    const idx = list.findIndex((doc) => doc.id === id);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    const updated = {
      ...list[idx],
      ...updates,
      id, // protect ID from being overwritten
      updatedAt: now,
    };
    list[idx] = updated;
    return clone(updated);
  },

  delete(collection, id) {
    const list = this.get(collection);
    const idx = list.findIndex((doc) => doc.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  },
};

module.exports = store;
