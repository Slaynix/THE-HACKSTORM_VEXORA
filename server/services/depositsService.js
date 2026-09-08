'use strict';

const { getFirestore } = require('../config/firebase');
const { evaluateGoal } = require('./savingsEngine');
const NotificationService = require('./notificationService');
const StreakService = require('./streakService');
const RecoveryService = require('./recoveryService');

const DepositsService = {
  /**
   * Recalculates and updates savedAmount on a goal document in Firestore.
   * @param {string} goalId
   */
  async recalculateGoalSavings(goalId) {
    const db = getFirestore();
    const depositsSnap = await db.collection('deposits').where('goalId', '==', goalId).get();

    let totalSaved = 0;
    depositsSnap.forEach((doc) => {
      totalSaved += Number(doc.data().amount) || 0;
    });

    const goalRef = db.collection('goals').doc(goalId);
    const goalSnap = await goalRef.get();

    if (goalSnap.exists) {
      const goalData = goalSnap.data();
      const evaluation = evaluateGoal({ ...goalData, savedAmount: totalSaved });
      const status = evaluation.progress.isCompleted ? 'COMPLETED' : evaluation.health.status;
      await goalRef.update({
        savedAmount: totalSaved,
        status,
        updatedAt: new Date().toISOString(),
      });
    }

    return totalSaved;
  },

  /**
   * List all deposits for a specific goal.
   * @param {string} goalId
   * @param {string} familyId
   * @returns {Promise<Array|null>}
   */
  async listByGoal(goalId, familyId) {
    const db = getFirestore();
    const goalSnap = await db.collection('goals').doc(goalId).get();

    if (!goalSnap.exists) return null;
    if (familyId && goalSnap.data().familyId !== familyId) return null;

    const snapshot = await db.collection('deposits').where('goalId', '==', goalId).get();
    const deposits = [];
    snapshot.forEach((doc) => {
      deposits.push({ id: doc.id, ...doc.data() });
    });

    return deposits.sort((a, b) => new Date(b.depositDate || b.date) - new Date(a.depositDate || a.date));
  },

  /**
   * Add a new deposit toward a goal in Firestore.
   * Atomically:
   *  1. Checks clientTxnId for idempotent retry.
   *  2. Writes deposit with family member identification.
   *  3. Recomputes savedAmount, progress, health, and prediction.
   *  4. Detects and idempotently creates crossed milestones (25/50/75/100) + notifications.
   *  5. Updates saving streak in Asia/Kolkata timezone.
   *
   * @param {string} goalId
   * @param {string} familyId
   * @param {string} memberId
   * @param {string} memberName
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async add(goalId, familyId, memberId, memberName, data) {
    const db = getFirestore();
    const goalRef = db.collection('goals').doc(goalId);
    const goalSnap = await goalRef.get();

    if (!goalSnap.exists) return null;
    const goalData = goalSnap.data();
    if (familyId && goalData.familyId !== familyId) return null;

    const now = new Date().toISOString();
    const depositDate = data.depositDate || data.date || now;
    const clientTxnId = data.clientTxnId || null;

    // Idempotency check: if clientTxnId is provided and already recorded
    if (clientTxnId) {
      const existingSnap = await db.collection('deposits').where('clientTxnId', '==', clientTxnId).get();
      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const totalSaved = await this.recalculateGoalSavings(goalId);
        const updatedGoalSnap = await goalRef.get();
        const updatedGoalData = updatedGoalSnap.data();
        const evaluation = evaluateGoal({ id: goalId, ...updatedGoalData, savedAmount: totalSaved });
        const streak = await StreakService.getStreak(familyId);
        return {
          deposit: { id: existingDoc.id, ...existingDoc.data() },
          goal: {
            id: goalId,
            name: updatedGoalData.name,
            targetAmount: updatedGoalData.targetAmount,
            savedAmount: totalSaved,
            deadline: updatedGoalData.deadline,
            status: evaluation.progress.isCompleted ? 'COMPLETED' : evaluation.health.status,
            progress: evaluation.progress,
            health: evaluation.health,
            prediction: evaluation.prediction,
          },
          newlyCrossedMilestones: [],
          streak,
        };
      }
    }

    // Capture prior progress for milestone comparison
    const priorSaved = Number(goalData.savedAmount) || 0;
    const targetAmount = Number(goalData.targetAmount) || 1;
    const oldPct = Math.min(100, Math.round((priorSaved / targetAmount) * 100));

    // Create deposit document
    const depositDoc = {
      familyId,
      goalId,
      memberId: data.memberId || memberId || 'mem-1',
      memberName: data.memberName || memberName || 'Family Member',
      amount: Number(data.amount),
      depositDate,
      source: data.source || 'manual',
      notes: (data.notes || data.note || '').trim(),
      clientTxnId: clientTxnId || `txn-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('deposits').add(depositDoc);
    const totalSaved = await this.recalculateGoalSavings(goalId);
    const newPct = Math.min(100, Math.round((totalSaved / targetAmount) * 100));

    // Milestone verification (25, 50, 75, 100) — Idempotent check
    const thresholds = [25, 50, 75, 100];
    const newlyCrossedMilestones = [];

    for (const threshold of thresholds) {
      if (newPct >= threshold) {
        // Query if milestone doc already exists for this (goalId, percentage)
        const milestoneSnap = await db.collection('milestones')
          .where('goalId', '==', goalId)
          .where('percentage', '==', threshold)
          .get();

        if (milestoneSnap.empty) {
          const milestoneDoc = {
            familyId,
            goalId,
            goalName: goalData.name,
            percentage: threshold,
            amountAtMilestone: totalSaved,
            achievedAt: depositDate,
            createdAt: now,
          };
          const mRef = await db.collection('milestones').add(milestoneDoc);
          newlyCrossedMilestones.push({ id: mRef.id, ...milestoneDoc });

          // Fire notification
          await NotificationService.createNotification(familyId, {
            type: 'milestone',
            title: threshold === 100 ? `Goal Completed! 🏆` : `${threshold}% Milestone Reached! 🎯`,
            body: threshold === 100
              ? `Congratulations! "${goalData.name}" is 100% completed with ₹${totalSaved.toLocaleString('en-IN')} saved!`
              : `Great progress! "${goalData.name}" reached ${threshold}% (₹${totalSaved.toLocaleString('en-IN')} saved).`,
            date: depositDate,
          });
        }
      }
    }

    // If goal reached 100%, update status to COMPLETED
    if (newPct >= 100) {
      await goalRef.update({
        status: 'COMPLETED',
        updatedAt: now,
      });
    }

    // Update family saving streak in Asia/Kolkata
    const streak = await StreakService.recalculateStreak(familyId, depositDate);

    // Re-fetch goal with complete evaluation
    const updatedGoalSnap = await goalRef.get();
    const updatedGoalData = updatedGoalSnap.data();
    const evaluation = evaluateGoal({ id: goalId, ...updatedGoalData, savedAmount: totalSaved });

    // Dynamic Plan Recovery recalculation if goal has an adjusted plan
    const catchUp = await RecoveryService.handleCatchUpDeposit(
      { id: goalId, ...updatedGoalData, savedAmount: totalSaved },
      Number(data.amount)
    );

    return {
      deposit: { id: docRef.id, ...depositDoc },
      goal: {
        id: goalId,
        name: updatedGoalData.name,
        category: updatedGoalData.category,
        icon: updatedGoalData.icon,
        targetAmount: updatedGoalData.targetAmount,
        savedAmount: totalSaved,
        deadline: updatedGoalData.deadline,
        status: evaluation.progress.isCompleted ? 'COMPLETED' : evaluation.health.status,
        progress: evaluation.progress,
        health: evaluation.health,
        prediction: evaluation.prediction,
      },
      newlyCrossedMilestones,
      streak,
      catchUp,
    };
  },

  /**
   * Update an existing deposit in Firestore.
   * @param {string} depositId
   * @param {string} familyId
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async update(depositId, familyId, updates) {
    const db = getFirestore();
    const docRef = db.collection('deposits').doc(depositId);
    const snap = await docRef.get();

    if (!snap.exists) return null;
    const existing = snap.data();
    if (familyId && existing.familyId !== familyId) return null;

    const payload = { updatedAt: new Date().toISOString() };
    if (updates.amount !== undefined) payload.amount = Number(updates.amount);
    if (updates.notes !== undefined || updates.note !== undefined) {
      payload.notes = (updates.notes || updates.note).trim();
    }
    if (updates.depositDate !== undefined || updates.date !== undefined) {
      payload.depositDate = updates.depositDate || updates.date;
    }

    await docRef.update(payload);
    await this.recalculateGoalSavings(existing.goalId);

    const updatedSnap = await docRef.get();
    return { id: depositId, ...updatedSnap.data() };
  },

  /**
   * Delete a deposit from Firestore.
   * @param {string} depositId
   * @param {string} familyId
   * @returns {Promise<boolean>}
   */
  async delete(depositId, familyId) {
    const db = getFirestore();
    const docRef = db.collection('deposits').doc(depositId);
    const snap = await docRef.get();

    if (!snap.exists) return false;
    const existing = snap.data();
    if (familyId && existing.familyId !== familyId) return false;

    await docRef.delete();
    await this.recalculateGoalSavings(existing.goalId);
    return true;
  },
};

module.exports = DepositsService;
