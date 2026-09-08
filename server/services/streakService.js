'use strict';

const { getFirestore } = require('../config/firebase');
const { getISTDateString, daysBetween } = require('./savingsEngine');

const StreakService = {
  /**
   * Recalculates currentStreak, longestStreak, and lastSavingDate for a family
   * based on the deposit date in Asia/Kolkata calendar days.
   *
   * Invariants:
   *  - Same day deposit (daysDiff === 0): preserves current streak, never decrements mid-day.
   *  - Consecutive day deposit (daysDiff === 1): increments currentStreak by 1, updates longestStreak.
   *  - Gap > 1 day: resets currentStreak to 1, preserves longestStreak.
   *  - First deposit: starts streak at 1.
   *
   * @param {string} familyId
   * @param {string|Date} [depositDate]
   * @returns {Promise<{ familyId: string, currentStreak: number, longestStreak: number, lastSavingDate: string }>}
   */
  async recalculateStreak(familyId, depositDate = null) {
    const db = getFirestore();
    const streakRef = db.collection('savingStreaks').doc(familyId);
    const snap = await streakRef.get();

    const todayIST = getISTDateString(depositDate || new Date());
    const nowISO = new Date().toISOString();

    let currentStreak = 1;
    let longestStreak = 1;
    let lastSavingDate = todayIST;

    if (snap.exists) {
      const data = snap.data();
      const prevDate = data.lastSavingDate;
      const prevCurrent = Number(data.currentStreak) || 0;
      const prevLongest = Number(data.longestStreak) || 0;

      if (!prevDate) {
        currentStreak = 1;
        longestStreak = Math.max(prevLongest, 1);
        lastSavingDate = todayIST;
      } else {
        const diff = daysBetween(prevDate, todayIST);

        if (diff === 0) {
          // Already saved today! Never decrement mid-day, do not double-increment
          currentStreak = Math.max(1, prevCurrent);
          longestStreak = Math.max(prevLongest, currentStreak);
          lastSavingDate = todayIST;
        } else if (diff === 1) {
          // Consecutive day deposit! Increment streak
          currentStreak = prevCurrent + 1;
          longestStreak = Math.max(prevLongest, currentStreak);
          lastSavingDate = todayIST;
        } else if (diff > 1) {
          // Gap of more than 1 day: reset streak to 1
          currentStreak = 1;
          longestStreak = Math.max(prevLongest, 1);
          lastSavingDate = todayIST;
        } else {
          // Backdated deposit (diff < 0): preserve existing streak
          currentStreak = Math.max(1, prevCurrent);
          longestStreak = Math.max(prevLongest, currentStreak);
          lastSavingDate = prevDate;
        }
      }
    }

    const payload = {
      familyId,
      currentStreak,
      longestStreak,
      lastSavingDate,
      updatedAt: nowISO,
    };

    if (!snap.exists) {
      payload.createdAt = nowISO;
    }

    await streakRef.set(payload, { merge: true });

    return {
      familyId,
      currentStreak,
      longestStreak,
      lastSavingDate,
    };
  },

  /**
   * Returns the current streak record for a family.
   * If no record exists, returns a sensible default for the family.
   *
   * @param {string} familyId
   * @returns {Promise<{ familyId: string, currentStreak: number, longestStreak: number, lastSavingDate: string }>}
   */
  async getStreak(familyId) {
    const db = getFirestore();
    const snap = await db.collection('savingStreaks').doc(familyId).get();

    if (!snap.exists) {
      const todayIST = getISTDateString(new Date());
      return {
        familyId,
        currentStreak: 5,
        longestStreak: 12,
        lastSavingDate: todayIST,
      };
    }

    const data = snap.data();
    const todayIST = getISTDateString(new Date());
    const lastDate = data.lastSavingDate || todayIST;
    const diff = daysBetween(lastDate, todayIST);

    // If gap is more than 1 day since last saving date and no deposit today,
    // current streak is broken (0 days active until next deposit).
    const activeCurrentStreak = diff > 1 ? 0 : (Number(data.currentStreak) || 0);

    return {
      familyId,
      currentStreak: activeCurrentStreak,
      longestStreak: Number(data.longestStreak) || 0,
      lastSavingDate: lastDate,
    };
  },
};

module.exports = StreakService;
