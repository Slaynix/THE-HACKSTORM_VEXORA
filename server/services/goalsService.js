'use strict';

const { getFirestore } = require('../config/firebase');
const { evaluateGoal } = require('./savingsEngine');
const NotificationService = require('./notificationService');

const GoalsService = {
  /**
   * List all goals for a family, enriched with complete savings engine metrics.
   * @param {string} familyId
   * @returns {Promise<Array>}
   */
  async listByFamily(familyId) {
    const db = getFirestore();
    const snapshot = await db.collection('goals').where('familyId', '==', familyId).get();
    const goals = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const goal = { id: doc.id, ...data };
      const evaluation = evaluateGoal(goal);
      const isCompleted = data.status === 'COMPLETED' || evaluation.progress.isCompleted;

      goals.push({
        ...goal,
        status: isCompleted ? 'COMPLETED' : evaluation.health.status,
        remaining: evaluation.progress.remaining,
        progress: evaluation.progress,
        health: evaluation.health,
        prediction: evaluation.prediction,
      });
    });

    return goals;
  },

  /**
   * Get a single goal by ID for a family, enriched with full metrics and
   * family contribution breakdown by member.
   *
   * @param {string} id
   * @param {string} familyId
   * @returns {Promise<Object|null>}
   */
  async getById(id, familyId) {
    const db = getFirestore();
    const docRef = db.collection('goals').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) return null;

    const data = snap.data();
    if (familyId && data.familyId !== familyId) {
      return null;
    }

    const goal = { id: snap.id, ...data };
    const evaluation = evaluateGoal(goal);
    const isCompleted = data.status === 'COMPLETED' || evaluation.progress.isCompleted;

    // Calculate Family Contribution Breakdown
    const depositsSnap = await db.collection('deposits').where('goalId', '==', id).get();
    const memberMap = {};
    let totalDepositsAmount = 0;

    depositsSnap.forEach((dDoc) => {
      const dep = dDoc.data();
      const mId = dep.memberId || 'mem-1';
      const mName = dep.memberName || 'Family Member';
      const amt = Number(dep.amount) || 0;

      if (!memberMap[mId]) {
        memberMap[mId] = {
          memberId: mId,
          memberName: mName,
          totalAmount: 0,
          depositCount: 0,
        };
      }
      memberMap[mId].totalAmount += amt;
      memberMap[mId].depositCount += 1;
      totalDepositsAmount += amt;
    });

    const contributions = Object.values(memberMap).map((m) => ({
      ...m,
      percentage: totalDepositsAmount > 0
        ? Math.round((m.totalAmount / totalDepositsAmount) * 100)
        : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      ...goal,
      status: isCompleted ? 'COMPLETED' : evaluation.health.status,
      remaining: evaluation.progress.remaining,
      progress: evaluation.progress,
      health: evaluation.health,
      prediction: evaluation.prediction,
      contributions,
    };
  },

  /**
   * Create a new savings goal in Firestore.
   * @param {string} familyId
   * @param {string} userId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(familyId, userId, data) {
    const db = getFirestore();
    const now = new Date().toISOString();

    const goalDoc = {
      familyId,
      createdBy: userId,
      name: data.name.trim(),
      category: data.category || 'other',
      targetAmount: Number(data.targetAmount),
      savedAmount: 0,
      deadline: data.deadline,
      status: 'ON_TRACK',
      icon: data.icon || '🎯',
      clientTxnId: data.clientTxnId || null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('goals').add(goalDoc);
    const goal = { id: docRef.id, ...goalDoc };
    const evaluation = evaluateGoal(goal);

    return {
      ...goal,
      remaining: evaluation.progress.remaining,
      progress: evaluation.progress,
      health: evaluation.health,
      prediction: evaluation.prediction,
      contributions: [],
    };
  },

  /**
   * Update an existing goal in Firestore.
   * Supports name, category, icon, targetAmount, deadline, savedAmount, and status (e.g. COMPLETED).
   *
   * @param {string} id
   * @param {string} familyId
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async update(id, familyId, updates) {
    const db = getFirestore();
    const docRef = db.collection('goals').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) return null;
    const existing = snap.data();
    if (familyId && existing.familyId !== familyId) return null;

    const now = new Date().toISOString();
    const payload = { updatedAt: now };

    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.icon !== undefined) payload.icon = updates.icon;
    if (updates.targetAmount !== undefined) payload.targetAmount = Number(updates.targetAmount);
    if (updates.deadline !== undefined) payload.deadline = updates.deadline;
    if (updates.savedAmount !== undefined) payload.savedAmount = Number(updates.savedAmount);

    const merged = { ...existing, ...payload, id };
    const evaluation = evaluateGoal(merged);

    // If explicit status provided (like 'COMPLETED'), respect it
    if (updates.status === 'COMPLETED' || evaluation.progress.isCompleted) {
      payload.status = 'COMPLETED';

      // Idempotent 100% milestone doc
      const mSnap = await db.collection('milestones')
        .where('goalId', '==', id)
        .where('percentage', '==', 100)
        .get();

      if (mSnap.empty) {
        await db.collection('milestones').add({
          familyId,
          goalId: id,
          goalName: merged.name,
          percentage: 100,
          amountAtMilestone: merged.savedAmount,
          achievedAt: now,
          createdAt: now,
        });

        await NotificationService.createNotification(familyId, {
          type: 'milestone',
          title: `Goal Completed! 🏆`,
          body: `Congratulations! "${merged.name}" has been marked as complete!`,
          date: now,
        });
      }
    } else {
      payload.status = evaluation.health.status;
    }

    await docRef.update(payload);

    return {
      ...merged,
      status: payload.status,
      remaining: evaluation.progress.remaining,
      progress: evaluation.progress,
      health: evaluation.health,
      prediction: evaluation.prediction,
    };
  },

  /**
   * Delete a goal and cascade-delete all its associated deposits and milestones
   * from Firestore in a batch so that no records are orphaned.
   *
   * @param {string} id
   * @param {string} familyId
   * @returns {Promise<boolean>}
   */
  async delete(id, familyId) {
    const db = getFirestore();
    const docRef = db.collection('goals').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) return false;
    const data = snap.data();
    if (familyId && data.familyId !== familyId) return false;

    const batch = db.batch();

    // 1. Delete associated deposits
    const depositsSnap = await db.collection('deposits').where('goalId', '==', id).get();
    depositsSnap.forEach((depDoc) => batch.delete(depDoc.ref));

    // 2. Delete associated milestones (prevent orphaned milestone records)
    const milestonesSnap = await db.collection('milestones').where('goalId', '==', id).get();
    milestonesSnap.forEach((mDoc) => batch.delete(mDoc.ref));

    // 3. Delete the goal itself
    batch.delete(docRef);

    await batch.commit();

    return true;
  },
};

module.exports = GoalsService;
